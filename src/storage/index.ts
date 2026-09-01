/**
 * Storage Module
 * Sistema profesional de gestión de archivos locales
 */

// Interfaces y tipos
export {
    StorageProvider,
    StoredFile,
    InputFile,
    UploadOptions,
    UrlOptions,
    FileMetadata,
    FileVariants
} from './StorageProvider';

// Proveedor de almacenamiento local
export { default as LocalStorageProvider, getStorageProvider } from './LocalStorageProvider';

// Servicios auxiliares
export { default as HashService } from './HashService';
export { default as FileProcessor, ThumbnailConfig, ProcessingOptions } from './FileProcessor';
export { default as CleanupService, getCleanupService } from './CleanupService';
