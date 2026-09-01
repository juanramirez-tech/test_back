import sharp from 'sharp';
import path from 'path';
import fs from 'fs/promises';
import { FileMetadata, FileVariants } from './StorageProvider';

/**
 * Configuración para thumbnails
 */
export interface ThumbnailConfig {
    width: number;
    height: number;
    fit?: 'cover' | 'contain' | 'fill' | 'inside' | 'outside';
    quality?: number;
}

/**
 * Opciones de procesamiento de imagen
 */
export interface ProcessingOptions {
    quality?: number;
    format?: 'jpeg' | 'png' | 'webp' | 'avif';
    maxWidth?: number;
    maxHeight?: number;
    preserveMetadata?: boolean;
}

/**
 * Configuración por defecto
 */
const DEFAULT_THUMBNAIL_CONFIG: ThumbnailConfig = {
    width: 300,
    height: 300,
    fit: 'cover',
    quality: 80
};

const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
    quality: 85,
    format: 'webp',
    maxWidth: 1920,
    maxHeight: 1080,
    preserveMetadata: false
};

/**
 * Servicio para procesamiento de imágenes
 * Utiliza Sharp para operaciones de alta performance
 */
class FileProcessor {
    /**
     * Verifica si un mimetype corresponde a una imagen procesable
     */
    static isProcessableImage(mimeType: string): boolean {
        const processable = [
            'image/jpeg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/avif',
            'image/tiff'
        ];
        return processable.includes(mimeType);
    }

    /**
     * Extrae metadatos de una imagen
     */
    static async extractMetadata(filePath: string): Promise<FileMetadata> {
        try {
            const metadata = await sharp(filePath).metadata();
            
            return {
                width: metadata.width,
                height: metadata.height,
                format: metadata.format,
                hasAlpha: metadata.hasAlpha,
                isAnimated: (metadata.pages && metadata.pages > 1) || false,
                orientation: metadata.orientation,
                exif: metadata.exif ? this.parseExif(metadata.exif) : undefined
            };
        } catch (error) {
            console.error('Error extracting metadata:', error);
            return {};
        }
    }

    /**
     * Parsea datos EXIF de un buffer
     */
    private static parseExif(exifBuffer: Buffer): Record<string, any> {
        try {
            // Sharp devuelve EXIF como buffer, aquí solo retornamos info básica
            // Para parsing completo se podría usar exif-reader
            return {
                raw: exifBuffer.toString('base64').substring(0, 100) + '...'
            };
        } catch {
            return {};
        }
    }

    /**
     * Genera un thumbnail de una imagen
     */
    static async generateThumbnail(
        inputPath: string,
        outputPath: string,
        config: ThumbnailConfig = DEFAULT_THUMBNAIL_CONFIG
    ): Promise<string> {
        await sharp(inputPath)
            .resize(config.width, config.height, {
                fit: config.fit || 'cover',
                position: 'center'
            })
            .webp({ quality: config.quality || 80 })
            .toFile(outputPath);

        return outputPath;
    }

    /**
     * Optimiza una imagen para web
     */
    static async optimizeImage(
        inputPath: string,
        outputPath: string,
        options: ProcessingOptions = DEFAULT_PROCESSING_OPTIONS
    ): Promise<{ path: string; size: number }> {
        let sharpInstance = sharp(inputPath);

        // Resize si excede dimensiones máximas
        if (options.maxWidth || options.maxHeight) {
            sharpInstance = sharpInstance.resize(options.maxWidth, options.maxHeight, {
                fit: 'inside',
                withoutEnlargement: true
            });
        }

        // Aplicar formato y calidad
        switch (options.format) {
            case 'webp':
                sharpInstance = sharpInstance.webp({ quality: options.quality });
                break;
            case 'avif':
                sharpInstance = sharpInstance.avif({ quality: options.quality });
                break;
            case 'jpeg':
                sharpInstance = sharpInstance.jpeg({ 
                    quality: options.quality,
                    mozjpeg: true 
                });
                break;
            case 'png':
                sharpInstance = sharpInstance.png({ 
                    quality: options.quality,
                    compressionLevel: 9 
                });
                break;
        }

        // Eliminar metadata si no se quiere preservar
        if (!options.preserveMetadata) {
            sharpInstance = sharpInstance.rotate(); // Auto-rotate based on EXIF
        }

        const result = await sharpInstance.toFile(outputPath);

        return {
            path: outputPath,
            size: result.size
        };
    }

    /**
     * Procesa una imagen: extrae metadatos, genera thumbnail y versión optimizada
     */
    static async processImage(
        inputPath: string,
        outputDir: string,
        filename: string,
        options: {
            generateThumbnail?: boolean;
            optimizeImage?: boolean;
            thumbnailConfig?: ThumbnailConfig;
            processingOptions?: ProcessingOptions;
        } = {}
    ): Promise<{
        metadata: FileMetadata;
        variants: FileVariants;
    }> {
        const {
            generateThumbnail = true,
            optimizeImage = true,
            thumbnailConfig = DEFAULT_THUMBNAIL_CONFIG,
            processingOptions = DEFAULT_PROCESSING_OPTIONS
        } = options;

        const metadata = await this.extractMetadata(inputPath);
        const variants: FileVariants = {};
        const baseName = path.parse(filename).name;

        // Generar thumbnail
        if (generateThumbnail) {
            const thumbnailPath = path.join(outputDir, 'thumbnails', `${baseName}_thumb.webp`);
            await fs.mkdir(path.dirname(thumbnailPath), { recursive: true });
            await this.generateThumbnail(inputPath, thumbnailPath, thumbnailConfig);
            variants.thumbnail = `${baseName}_thumb.webp`;
        }

        // Generar versión optimizada
        if (optimizeImage) {
            const optimizedPath = path.join(outputDir, 'optimized', `${baseName}_opt.webp`);
            await fs.mkdir(path.dirname(optimizedPath), { recursive: true });
            await this.optimizeImage(inputPath, optimizedPath, processingOptions);
            variants.optimized = `${baseName}_opt.webp`;
        }

        return { metadata, variants };
    }

    /**
     * Redimensiona una imagen a dimensiones específicas
     */
    static async resize(
        inputPath: string,
        outputPath: string,
        width: number,
        height?: number,
        options: { fit?: 'cover' | 'contain' | 'fill'; quality?: number } = {}
    ): Promise<void> {
        await sharp(inputPath)
            .resize(width, height, {
                fit: options.fit || 'inside',
                withoutEnlargement: true
            })
            .webp({ quality: options.quality || 85 })
            .toFile(outputPath);
    }

    /**
     * Convierte una imagen a un formato específico
     */
    static async convert(
        inputPath: string,
        outputPath: string,
        format: 'jpeg' | 'png' | 'webp' | 'avif',
        quality: number = 85
    ): Promise<void> {
        let sharpInstance = sharp(inputPath);

        switch (format) {
            case 'webp':
                sharpInstance = sharpInstance.webp({ quality });
                break;
            case 'avif':
                sharpInstance = sharpInstance.avif({ quality });
                break;
            case 'jpeg':
                sharpInstance = sharpInstance.jpeg({ quality, mozjpeg: true });
                break;
            case 'png':
                sharpInstance = sharpInstance.png({ quality, compressionLevel: 9 });
                break;
        }

        await sharpInstance.toFile(outputPath);
    }

    /**
     * Obtiene las dimensiones de una imagen sin procesar todo el archivo
     */
    static async getDimensions(filePath: string): Promise<{ width: number; height: number } | null> {
        try {
            const metadata = await sharp(filePath).metadata();
            if (metadata.width && metadata.height) {
                return { width: metadata.width, height: metadata.height };
            }
            return null;
        } catch {
            return null;
        }
    }
}

export default FileProcessor;
