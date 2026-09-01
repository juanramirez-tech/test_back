import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { Readable } from 'stream';
import {
    StorageProvider,
    StoredFile,
    InputFile,
    UploadOptions,
    UrlOptions,
    FileMetadata,
    FileVariants
} from './StorageProvider';
import HashService from './HashService';
import FileProcessor from './FileProcessor';
import { CANONICAL_EXTENSION } from '../utils/fileUtils';

/**
 * Categorías de archivos soportadas
 */
type FileCategory = 'image' | 'document' | 'other';

/**
 * Mapeo de MIME types a categorías
 */
const MIME_CATEGORY_MAP: Record<string, FileCategory> = {
    'image/jpeg': 'image',
    'image/png': 'image',
    'image/gif': 'image',
    'image/webp': 'image',
    'image/avif': 'image',
    'application/pdf': 'document',
    'application/msword': 'document',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'document',
    'application/vnd.ms-excel': 'document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': 'document',
    'text/plain': 'document',
    'text/csv': 'document'
};

/**
 * Configuración del proveedor de almacenamiento local
 */
interface LocalStorageConfig {
    basePath: string;
    baseUrl: string;
    maxFileSize: number;
    allowedMimeTypes: string[];
}

/**
 * Opciones por defecto para uploads
 */
const DEFAULT_UPLOAD_OPTIONS: UploadOptions = {
    generateThumbnail: true,
    optimizeImage: true,
    quality: 85,
    preserveOriginal: true,
    thumbnailSizes: [{ width: 300, height: 300 }]
};

/**
 * Proveedor de almacenamiento local
 * Implementa StorageProvider para gestión de archivos en el sistema de archivos local
 */
class LocalStorageProvider implements StorageProvider {
    private config: LocalStorageConfig;
    private fileRegistry: Map<string, StoredFile> = new Map();

    constructor(config?: Partial<LocalStorageConfig>) {
        this.config = {
            basePath: config?.basePath || path.join(process.cwd(), 'uploads'),
            baseUrl: config?.baseUrl || process.env.BACKEND_URL_UPLOADS || '/uploads/',
            maxFileSize: config?.maxFileSize || 10 * 1024 * 1024, // 10MB
            allowedMimeTypes: config?.allowedMimeTypes || Object.keys(MIME_CATEGORY_MAP)
        };

        this.initializeDirectories();
    }

    /**
     * Inicializa la estructura de directorios
     */
    private async initializeDirectories(): Promise<void> {
        const dirs = [
            path.join(this.config.basePath, 'images', 'originals'),
            path.join(this.config.basePath, 'images', 'thumbnails'),
            path.join(this.config.basePath, 'images', 'optimized'),
            path.join(this.config.basePath, 'documents'),
            path.join(this.config.basePath, 'other'),
            path.join(this.config.basePath, 'temp')
        ];

        for (const dir of dirs) {
            await fs.mkdir(dir, { recursive: true }).catch(() => {});
        }
    }

    /**
     * Determina la categoría de un archivo por su MIME type
     */
    private getCategory(mimeType: string): FileCategory {
        return MIME_CATEGORY_MAP[mimeType] || 'other';
    }

    /**
     * Obtiene la ruta de destino según la categoría
     */
    private getDestinationPath(category: FileCategory): string {
        switch (category) {
            case 'image':
                return path.join(this.config.basePath, 'images', 'originals');
            case 'document':
                return path.join(this.config.basePath, 'documents');
            default:
                return path.join(this.config.basePath, 'other');
        }
    }

    /**
     * Genera un nombre único para el archivo
     */
    private generateStoredName(mimeType: string): string {
        const ext = CANONICAL_EXTENSION[mimeType];
        if (!ext) {
            throw new Error('No hay extensión canónica para este tipo de archivo');
        }
        return `${HashService.generateFileId()}${ext}`;
    }

    /**
     * Sube un archivo al almacenamiento local
     */
    async upload(file: InputFile, options: UploadOptions = {}): Promise<StoredFile> {
        const opts = { ...DEFAULT_UPLOAD_OPTIONS, ...options };
        const category = this.getCategory(file.mimetype);
        const storedName = this.generateStoredName(file.mimetype);
        const destinationDir = this.getDestinationPath(category);
        const destinationPath = path.join(destinationDir, storedName);

        // Calcular hash del archivo
        const hash = await HashService.calculateFileHash(file.path);

        // Verificar duplicados
        const existing = await this.findByHash(hash);
        if (existing) {
            // Eliminar el archivo temporal si es duplicado
            await fs.unlink(file.path).catch(() => {});
            return existing;
        }

        // Mover archivo a destino final
        await fs.mkdir(destinationDir, { recursive: true });
        await fs.rename(file.path, destinationPath);

        // Inicializar metadatos y variantes
        let metadata: FileMetadata = {};
        let variants: FileVariants = {};

        // Procesar imágenes
        if (category === 'image' && FileProcessor.isProcessableImage(file.mimetype)) {
            const imagesDir = path.join(this.config.basePath, 'images');
            const result = await FileProcessor.processImage(
                destinationPath,
                imagesDir,
                storedName,
                {
                    generateThumbnail: opts.generateThumbnail,
                    optimizeImage: opts.optimizeImage,
                    processingOptions: { quality: opts.quality }
                }
            );
            metadata = result.metadata;
            variants = result.variants;
        }

        // Crear objeto StoredFile
        const storedFile: StoredFile = {
            id: HashService.generateFileId(),
            originalName: file.originalname,
            storedName,
            mimeType: file.mimetype,
            size: file.size,
            hash,
            path: path.relative(this.config.basePath, destinationPath),
            category,
            metadata,
            variants,
            url: this.getUrl(storedName, { variant: 'original' }),
            createdAt: new Date()
        };

        // Registrar en memoria (en producción esto sería la DB)
        this.fileRegistry.set(storedFile.id, storedFile);

        return storedFile;
    }

    /**
     * Elimina un archivo y todas sus variantes
     */
    async delete(fileId: string): Promise<boolean> {
        const file = this.fileRegistry.get(fileId);
        if (!file) return false;

        try {
            // Eliminar archivo original
            const originalPath = path.join(this.config.basePath, file.path);
            await fs.unlink(originalPath).catch(() => {});

            // Eliminar variantes
            if (file.variants.thumbnail) {
                const thumbPath = path.join(
                    this.config.basePath, 
                    'images', 
                    'thumbnails', 
                    file.variants.thumbnail
                );
                await fs.unlink(thumbPath).catch(() => {});
            }

            if (file.variants.optimized) {
                const optPath = path.join(
                    this.config.basePath, 
                    'images', 
                    'optimized', 
                    file.variants.optimized
                );
                await fs.unlink(optPath).catch(() => {});
            }

            // Eliminar del registro
            this.fileRegistry.delete(fileId);

            return true;
        } catch (error) {
            console.error('Error deleting file:', error);
            return false;
        }
    }

    /**
     * Obtiene la URL de un archivo
     */
    getUrl(storedName: string, options: UrlOptions = {}): string {
        const { variant = 'original' } = options;
        const baseName = path.parse(storedName).name;
        const baseUrl = this.config.baseUrl.endsWith('/') 
            ? this.config.baseUrl 
            : `${this.config.baseUrl}/`;

        switch (variant) {
            case 'thumbnail':
                return `${baseUrl}images/thumbnails/${baseName}_thumb.webp`;
            case 'optimized':
                return `${baseUrl}images/optimized/${baseName}_opt.webp`;
            default:
                // Para originales, necesitamos determinar la categoría
                // Por simplicidad, asumimos que si existe en images/originals, es imagen
                return `${baseUrl}images/originals/${storedName}`;
        }
    }

    /**
     * Obtiene la URL para documentos
     */
    getDocumentUrl(storedName: string): string {
        const baseUrl = this.config.baseUrl.endsWith('/') 
            ? this.config.baseUrl 
            : `${this.config.baseUrl}/`;
        return `${baseUrl}documents/${storedName}`;
    }

    /**
     * Obtiene un stream del archivo
     */
    stream(storedName: string, variant: string = 'original'): Readable | null {
        let filePath: string;

        switch (variant) {
            case 'thumbnail':
                const baseName = path.parse(storedName).name;
                filePath = path.join(
                    this.config.basePath, 
                    'images', 
                    'thumbnails', 
                    `${baseName}_thumb.webp`
                );
                break;
            case 'optimized':
                const baseNameOpt = path.parse(storedName).name;
                filePath = path.join(
                    this.config.basePath, 
                    'images', 
                    'optimized', 
                    `${baseNameOpt}_opt.webp`
                );
                break;
            default:
                filePath = path.join(this.config.basePath, 'images', 'originals', storedName);
        }

        if (!fsSync.existsSync(filePath)) {
            return null;
        }

        return fsSync.createReadStream(filePath);
    }

    /**
     * Verifica si un archivo existe
     */
    async exists(storedName: string): Promise<boolean> {
        const possiblePaths = [
            path.join(this.config.basePath, 'images', 'originals', storedName),
            path.join(this.config.basePath, 'documents', storedName),
            path.join(this.config.basePath, 'other', storedName)
        ];

        for (const p of possiblePaths) {
            try {
                await fs.access(p);
                return true;
            } catch {
                continue;
            }
        }

        return false;
    }

    /**
     * Busca un archivo por su hash (para deduplicación)
     */
    async findByHash(hash: string): Promise<StoredFile | null> {
        for (const file of this.fileRegistry.values()) {
            if (file.hash === hash) {
                return file;
            }
        }
        return null;
    }

    /**
     * Obtiene estadísticas del almacenamiento
     */
    async getStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        byCategory: Record<string, { count: number; size: number }>;
    }> {
        const stats = {
            totalFiles: 0,
            totalSize: 0,
            byCategory: {} as Record<string, { count: number; size: number }>
        };

        for (const file of this.fileRegistry.values()) {
            stats.totalFiles++;
            stats.totalSize += file.size;

            if (!stats.byCategory[file.category]) {
                stats.byCategory[file.category] = { count: 0, size: 0 };
            }
            stats.byCategory[file.category].count++;
            stats.byCategory[file.category].size += file.size;
        }

        return stats;
    }

    /**
     * Limpia archivos temporales antiguos
     */
    async cleanupTempFiles(maxAgeMs: number = 24 * 60 * 60 * 1000): Promise<number> {
        const tempDir = path.join(this.config.basePath, 'temp');
        let deletedCount = 0;

        try {
            const files = await fs.readdir(tempDir);
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                const stat = await fs.stat(filePath);

                if (now - stat.mtimeMs > maxAgeMs) {
                    await fs.unlink(filePath);
                    deletedCount++;
                }
            }
        } catch (error) {
            console.error('Error cleaning temp files:', error);
        }

        return deletedCount;
    }

    /**
     * Obtiene la ruta base del almacenamiento
     */
    getBasePath(): string {
        return this.config.basePath;
    }

    /**
     * Obtiene la configuración actual
     */
    getConfig(): LocalStorageConfig {
        return { ...this.config };
    }
}

// Instancia singleton para uso global
let storageInstance: LocalStorageProvider | null = null;

export const getStorageProvider = (config?: Partial<LocalStorageConfig>): LocalStorageProvider => {
    if (!storageInstance) {
        storageInstance = new LocalStorageProvider(config);
    }
    return storageInstance;
};

export default LocalStorageProvider;
