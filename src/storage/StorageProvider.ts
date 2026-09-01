import { Readable } from 'stream';

/**
 * Opciones para generar URLs de archivos
 */
export interface UrlOptions {
    variant?: 'original' | 'thumbnail' | 'optimized';
    signed?: boolean;
    expiresIn?: number; // segundos
}

/**
 * Metadatos de archivo almacenado
 */
export interface FileMetadata {
    width?: number;
    height?: number;
    duration?: number;
    format?: string;
    hasAlpha?: boolean;
    isAnimated?: boolean;
    orientation?: number;
    exif?: Record<string, any>;
}

/**
 * Variantes generadas del archivo
 */
export interface FileVariants {
    thumbnail?: string;
    optimized?: string;
    [key: string]: string | undefined;
}

/**
 * Información completa de un archivo almacenado
 */
export interface StoredFile {
    id: string;
    originalName: string;
    storedName: string;
    mimeType: string;
    size: number;
    hash: string;
    path: string;
    category: 'image' | 'document' | 'other';
    metadata: FileMetadata;
    variants: FileVariants;
    url: string;
    createdAt: Date;
}

/**
 * Opciones para subir archivos
 */
export interface UploadOptions {
    generateThumbnail?: boolean;
    optimizeImage?: boolean;
    thumbnailSizes?: { width: number; height: number }[];
    quality?: number;
    preserveOriginal?: boolean;
}

/**
 * Archivo de entrada para upload
 */
export interface InputFile {
    fieldname: string;
    originalname: string;
    encoding: string;
    mimetype: string;
    destination: string;
    filename: string;
    path: string;
    size: number;
}

/**
 * Interface base para proveedores de almacenamiento
 * Permite implementar diferentes backends (Local, S3, MinIO, etc.)
 */
export interface StorageProvider {
    /**
     * Sube un archivo al almacenamiento
     */
    upload(file: InputFile, options?: UploadOptions): Promise<StoredFile>;

    /**
     * Elimina un archivo y todas sus variantes
     */
    delete(fileId: string): Promise<boolean>;

    /**
     * Obtiene la URL de un archivo
     */
    getUrl(storedName: string, options?: UrlOptions): string;

    /**
     * Obtiene un stream del archivo para descarga
     */
    stream(storedName: string, variant?: string): Readable | null;

    /**
     * Verifica si un archivo existe
     */
    exists(storedName: string): Promise<boolean>;

    /**
     * Obtiene información de un archivo por su hash (para deduplicación)
     */
    findByHash(hash: string): Promise<StoredFile | null>;

    /**
     * Obtiene estadísticas del almacenamiento
     */
    getStats(): Promise<{
        totalFiles: number;
        totalSize: number;
        byCategory: Record<string, { count: number; size: number }>;
    }>;
}

export default StorageProvider;
