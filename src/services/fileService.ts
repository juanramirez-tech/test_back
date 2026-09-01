import fs from 'fs/promises';
import path from 'path';
import File, { LocalFileInfo } from '../models/file';
import { 
    getStorageProvider, 
    StoredFile, 
    InputFile,
    UploadOptions 
} from '../storage';
import { FileValidationError, normalizeUploadedFile } from '../utils/fileUtils';
import { buildSignedMediaUrl, mediaPathForStoredFile } from '../utils/mediaUrl';

/**
 * Interfaz para archivos de Multer agrupados
 */
export interface MulterFiles {
    [fieldname: string]: Express.Multer.File[];
}

/**
 * Opciones para creación de archivos
 */
interface CreateFileOptions extends UploadOptions {
    generateThumbnail?: boolean;
    optimizeImage?: boolean;
}

/**
 * Servicio para gestión de archivos
 * Maneja el ciclo de vida completo de archivos: creación, actualización, eliminación
 */
class FileService {
    /**
     * Convierte un archivo Multer a InputFile
     */
    private static toInputFile(file: Express.Multer.File): InputFile {
        return {
            fieldname: file.fieldname,
            originalname: file.originalname,
            encoding: file.encoding,
            mimetype: file.mimetype,
            destination: file.destination,
            filename: file.filename,
            path: file.path,
            size: file.size
        };
    }

    /**
     * Convierte StoredFile a LocalFileInfo para almacenar en DB
     */
    private static toLocalFileInfo(stored: StoredFile, fieldname: string): LocalFileInfo {
        return {
            fieldname,
            originalname: stored.originalName,
            storedName: stored.storedName,
            encoding: 'utf-8',
            mimetype: stored.mimeType,
            size: stored.size,
            hash: stored.hash,
            path: stored.path,
            category: stored.category,
            metadata: stored.metadata,
            variants: stored.variants
        };
    }

    /**
     * Crea un nuevo registro de archivo
     */
    static async createFile(
        name: string, 
        files: MulterFiles, 
        options: CreateFileOptions = {}
    ): Promise<File> {
        const storage = getStorageProvider();
        let mainFileInfo: LocalFileInfo | null = null;
        const additionalFilesInfo: LocalFileInfo[] = [];

        try {
            const incoming = [
                ...(files['mainFile'] || []),
                ...(files['additionalFiles'] || [])
            ];
            for (const incomingFile of incoming) {
                await normalizeUploadedFile(incomingFile);
            }

            // Procesar archivo principal
            if (files['mainFile']?.[0]) {
                const mainFile = files['mainFile'][0];
                const stored = await storage.upload(this.toInputFile(mainFile), options);
                mainFileInfo = this.toLocalFileInfo(stored, 'mainFile');
            }

            // Procesar archivos adicionales
            if (files['additionalFiles']) {
                for (const file of files['additionalFiles']) {
                    const stored = await storage.upload(this.toInputFile(file), options);
                    additionalFilesInfo.push(this.toLocalFileInfo(stored, 'additionalFiles'));
                }
            }

            // Crear registro en base de datos
            const newFile = await File.create({
                name,
                mainFile: mainFileInfo,
                additionalFiles: additionalFilesInfo
            });

            return newFile;
        } catch (error) {
            // Limpiar archivos en caso de error
            await this.cleanupUploadedFiles(files);
            throw error;
        }
    }

    /**
     * Actualiza un archivo existente
     */
    static async updateFile(
        fileId: number | string, 
        name: string | undefined, 
        files: MulterFiles,
        options: CreateFileOptions = {}
    ): Promise<File | null> {
        const file = await File.findByPk(fileId);
        
        if (!file) return null;

        const storage = getStorageProvider();

        try {
            const incoming = [
                ...(files['mainFile'] || []),
                ...(files['additionalFiles'] || [])
            ];
            for (const incomingFile of incoming) {
                await normalizeUploadedFile(incomingFile);
            }

            let mainFileInfo = file.mainFile;
            let additionalFilesInfo = file.additionalFiles || [];

            // Actualizar archivo principal si se proporciona uno nuevo
            if (files['mainFile']?.[0]) {
                // Eliminar archivo anterior si existe
                if (file.mainFile) {
                    await this.deleteStoredFile(file.mainFile);
                }

                // Subir nuevo archivo
                const mainFile = files['mainFile'][0];
                const stored = await storage.upload(this.toInputFile(mainFile), options);
                mainFileInfo = this.toLocalFileInfo(stored, 'mainFile');
            }

            // Actualizar archivos adicionales si se proporcionan nuevos
            if (files['additionalFiles']) {
                // Eliminar archivos anteriores
                for (const oldFile of additionalFilesInfo) {
                    await this.deleteStoredFile(oldFile);
                }

                // Subir nuevos archivos
                additionalFilesInfo = [];
                for (const addFile of files['additionalFiles']) {
                    const stored = await storage.upload(this.toInputFile(addFile), options);
                    additionalFilesInfo.push(this.toLocalFileInfo(stored, 'additionalFiles'));
                }
            }

            // Actualizar registro
            await file.update({
                name: name || file.name,
                mainFile: mainFileInfo,
                additionalFiles: additionalFilesInfo
            });

            return file;
        } catch (error) {
            // Limpiar archivos en caso de error
            await this.cleanupUploadedFiles(files);
            throw error;
        }
    }

    /**
     * Obtiene todos los archivos
     */
    static async getAllFiles(): Promise<File[]> {
        return await File.findAll();
    }

    /**
     * Obtiene un archivo por ID
     */
    static async getFileById(id: number | string): Promise<File | null> {
        return await File.findByPk(id);
    }

    /**
     * Elimina un archivo y sus recursos asociados
     */
    static async deleteFile(fileId: number | string): Promise<boolean> {
        const file = await File.findByPk(fileId);
        
        if (!file) return false;

        try {
            // Eliminar archivo principal
            if (file.mainFile) {
                await this.deleteStoredFile(file.mainFile);
            }

            // Eliminar archivos adicionales
            if (file.additionalFiles && Array.isArray(file.additionalFiles)) {
                for (const fileInfo of file.additionalFiles) {
                    await this.deleteStoredFile(fileInfo);
                }
            }

            // Eliminar el registro de la base de datos
            await file.destroy();
            return true;
        } catch (error) {
            console.error('Error al eliminar archivo:', error);
            throw error;
        }
    }

    /**
     * Elimina un archivo almacenado y sus variantes
     */
    private static async deleteStoredFile(fileInfo: LocalFileInfo): Promise<void> {
        const basePath = getStorageProvider().getBasePath();
        const originalPath = this.safeResolve(basePath, fileInfo.path);
        await fs.unlink(originalPath).catch(() => {});

        if (fileInfo.variants) {
            if (fileInfo.variants.thumbnail) {
                const thumbPath = this.safeResolve(basePath, 'images', 'thumbnails', fileInfo.variants.thumbnail);
                await fs.unlink(thumbPath).catch(() => {});
            }

            if (fileInfo.variants.optimized) {
                const optPath = this.safeResolve(basePath, 'images', 'optimized', fileInfo.variants.optimized);
                await fs.unlink(optPath).catch(() => {});
            }
        }
    }

    private static safeResolve(basePath: string, ...parts: string[]): string {
        const root = path.resolve(basePath);
        const resolved = path.resolve(basePath, ...parts);
        if (resolved !== root && !resolved.startsWith(root + path.sep)) {
            throw new FileValidationError('Ruta de archivo no válida');
        }
        return resolved;
    }

    /**
     * Transforma los datos del archivo agregando URLs completas
     */
    static transformFileUrls(fileData: any): any {
        const transformedData = JSON.parse(JSON.stringify(fileData));

        const addUrls = (file: LocalFileInfo) => {
            const url = buildSignedMediaUrl(mediaPathForStoredFile(file.storedName, file.category));
            let thumbnailUrl: string | null = null;
            let optimizedUrl: string | null = null;

            if (file.category === 'image') {
                if (file.variants?.thumbnail) {
                    thumbnailUrl = buildSignedMediaUrl(
                        mediaPathForStoredFile(file.variants.thumbnail, 'image', 'thumbnail')
                    );
                }
                if (file.variants?.optimized) {
                    optimizedUrl = buildSignedMediaUrl(
                        mediaPathForStoredFile(file.variants.optimized, 'image', 'optimized')
                    );
                }
            }

            return {
                ...file,
                url,
                thumbnailUrl,
                optimizedUrl
            };
        };

        // Transformar archivo principal
        if (transformedData.mainFile) {
            transformedData.mainFile = addUrls(transformedData.mainFile);
        }

        // Transformar archivos adicionales
        if (transformedData.additionalFiles && Array.isArray(transformedData.additionalFiles)) {
            transformedData.additionalFiles = transformedData.additionalFiles.map(addUrls);
        }

        return transformedData;
    }

    /**
     * Limpia archivos subidos en caso de error
     */
    private static async cleanupUploadedFiles(files: MulterFiles): Promise<void> {
        try {
            if (files['mainFile']?.[0]) {
                await fs.unlink(files['mainFile'][0].path).catch(() => {});
            }
            if (files['additionalFiles']) {
                for (const file of files['additionalFiles']) {
                    await fs.unlink(file.path).catch(() => {});
                }
            }
        } catch (error) {
            console.error('Error al limpiar archivos temporales:', error);
        }
    }

    /**
     * Obtiene estadísticas de almacenamiento
     */
    static async getStorageStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        byCategory: Record<string, { count: number; size: number }>;
    }> {
        const storage = getStorageProvider();
        return storage.getStats();
    }

    /**
     * Verifica si un archivo existe por su hash (para detectar duplicados)
     */
    static async findDuplicate(hash: string): Promise<File | null> {
        const files = await File.findAll();
        
        for (const file of files) {
            if (file.mainFile?.hash === hash) {
                return file;
            }
            
            if (file.additionalFiles) {
                for (const addFile of file.additionalFiles) {
                    if (addFile.hash === hash) {
                        return file;
                    }
                }
            }
        }
        
        return null;
    }
}

export default FileService;
