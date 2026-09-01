import multer from 'multer';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { buildSignedMediaUrl, mediaPathForStoredFile } from './mediaUrl';

/**
 * file-type is ESM-only; TypeScript emits require() for static imports under commonjs.
 * This preserves a real dynamic import at runtime.
 */
type FileTypeModule = {
    fileTypeFromFile: (filePath: string) => Promise<{ mime: string; ext: string } | undefined>;
};

const loadFileType = () =>
    new Function('return import("file-type")')() as Promise<FileTypeModule>;

/**
 * Información básica de archivo
 */
export interface FileInfo {
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
 * Archivos agrupados por campo
 */
export interface MulterFiles {
    [fieldname: string]: Express.Multer.File[];
}

/**
 * Tipos de archivo permitidos
 */
export enum FileType {
    IMAGE = 'image',
    DOCUMENT = 'document',
    ALL = 'all'
}

// ============================================================================
// Configuración
// ============================================================================

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_FILES = 20;
const UPLOAD_PATH = path.join(process.cwd(), 'uploads', 'temp');

/**
 * MIME types permitidos por categoría
 */
const ALLOWED_MIME_TYPES: Record<FileType, string[]> = {
    [FileType.IMAGE]: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif'
    ],
    [FileType.DOCUMENT]: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ],
    [FileType.ALL]: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/avif',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'text/plain',
        'text/csv'
    ]
};

export const CANONICAL_EXTENSION: Record<string, string> = {
    'image/jpeg': '.jpg',
    'image/png': '.png',
    'image/gif': '.gif',
    'image/webp': '.webp',
    'image/avif': '.avif',
    'application/pdf': '.pdf',
    'application/msword': '.doc',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': '.docx',
    'application/vnd.ms-excel': '.xls',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': '.xlsx',
    'text/plain': '.txt',
    'text/csv': '.csv'
};

export class FileValidationError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'FileValidationError';
    }
}

// ============================================================================
// Inicialización
// ============================================================================

/**
 * Inicializa el directorio de uploads temporal
 */
const initializeUploadDir = (): void => {
    if (!fs.existsSync(UPLOAD_PATH)) {
        fs.mkdirSync(UPLOAD_PATH, { recursive: true });
    }
};

// ============================================================================
// Almacenamiento de Multer
// ============================================================================

/**
 * Genera un nombre de archivo único
 */
const generateUniqueFilename = (): string => {
    const timestamp = Date.now().toString(36);
    const random = crypto.randomBytes(8).toString('hex');
    return `${timestamp}-${random}.part`;
};

/**
 * Configuración del almacenamiento temporal
 */
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        initializeUploadDir();
        cb(null, UPLOAD_PATH);
    },
    filename: (req, file, cb) => {
        cb(null, generateUniqueFilename());
    }
});

// ============================================================================
// Filtros de Archivos
// ============================================================================

/**
 * Crea un filtro de tipos de archivo
 */
const createFileFilter = (fileType: FileType = FileType.ALL) => {
    return (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
        const allowedTypes = ALLOWED_MIME_TYPES[fileType];

        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error(`Tipo de archivo no permitido: ${file.mimetype}. Permitidos: ${allowedTypes.join(', ')}`));
        }
    };
};

// ============================================================================
// Configuración de Multer
// ============================================================================

/**
 * Crea una instancia de Multer con opciones personalizadas
 */
export const createMulterUpload = (options: {
    fileType?: FileType;
    maxFileSize?: number;
    maxFiles?: number;
} = {}) => {
    const {
        fileType = FileType.ALL,
        maxFileSize = MAX_FILE_SIZE,
        maxFiles = MAX_FILES
    } = options;

    return multer({
        storage,
        fileFilter: createFileFilter(fileType),
        limits: {
            fileSize: maxFileSize,
            files: maxFiles
        }
    });
};

/**
 * Instancia de upload por defecto
 */
export const upload = createMulterUpload();

/**
 * Upload para un solo archivo
 */
export const uploadSingle = (fieldName: string = 'file', fileType: FileType = FileType.ALL) => {
    return createMulterUpload({ fileType }).single(fieldName);
};

/**
 * Upload para múltiples archivos
 */
export const uploadMultiple = (
    fieldName: string = 'files',
    maxCount: number = MAX_FILES,
    fileType: FileType = FileType.ALL
) => {
    return createMulterUpload({ fileType, maxFiles: maxCount }).array(fieldName, maxCount);
};

// ============================================================================
// Procesamiento de Archivos
// ============================================================================

/**
 * Procesa los archivos subidos
 */
export const processUploadedFiles = (files: Express.Multer.File[]): FileInfo[] => {
    return files.map(file => ({
        fieldname: file.fieldname,
        originalname: file.originalname,
        encoding: file.encoding,
        mimetype: file.mimetype,
        destination: file.destination,
        filename: file.filename,
        path: file.path,
        size: file.size
    }));
};

/**
 * Elimina un archivo
 */
export const deleteFile = async (filePath: string): Promise<boolean> => {
    try {
        if (fs.existsSync(filePath)) {
            await fs.promises.unlink(filePath);
        }
        return true;
    } catch (error) {
        console.error('Error al eliminar archivo:', error);
        return false;
    }
};

/**
 * Obtiene la URL de un archivo
 */
export const getFileUrl = (filename: string, category: 'image' | 'document' | 'other' = 'other'): string => {
    return buildSignedMediaUrl(mediaPathForStoredFile(filename, category));
};

// ============================================================================
// Middleware de Errores
// ============================================================================

/**
 * Middleware para manejar errores de Multer
 */
export const handleMulterError = (
    err: any,
    req: Request,
    res: Response,
    next: NextFunction
) => {
    if (err instanceof multer.MulterError) {
        switch (err.code) {
            case 'LIMIT_FILE_SIZE':
                return res.status(400).json({
                    error: 'El archivo excede el tamaño máximo permitido',
                    details: `Tamaño máximo: ${MAX_FILE_SIZE / (1024 * 1024)}MB`
                });
            case 'LIMIT_FILE_COUNT':
                return res.status(400).json({
                    error: 'Se excedió el número máximo de archivos',
                    details: `Máximo: ${MAX_FILES} archivos`
                });
            case 'LIMIT_UNEXPECTED_FILE':
                return res.status(400).json({
                    error: 'Campo de archivo inesperado',
                    details: err.field
                });
            default:
                return res.status(400).json({ error: err.message });
        }
    } else if (err) {
        return res.status(400).json({ error: err.message });
    }
    next();
};

// ============================================================================
// Validaciones
// ============================================================================

/**
 * Valida el payload de archivos
 */
export const validateFilePayload = (files: any): boolean => {
    if (!files) return false;

    const hasMainFile = files['mainFile'] && files['mainFile'].length > 0;
    const hasAdditionalFiles = files['additionalFiles'] && files['additionalFiles'].length > 0;

    return hasMainFile || hasAdditionalFiles;
};

/**
 * Valida el tipo real de archivo (magic bytes)
 * Más seguro que confiar solo en el MIME type reportado
 */
export const validateRealFileType = async (
    filePath: string,
    expectedTypes: string[]
): Promise<boolean> => {
    try {
        const detected = await detectSafeMime(filePath, expectedTypes);
        return expectedTypes.includes(detected);
    } catch {
        return false;
    }
};

const looksLikePlainText = async (filePath: string): Promise<boolean> => {
    const handle = await fs.promises.open(filePath, 'r');
    try {
        const buffer = Buffer.alloc(512);
        const { bytesRead } = await handle.read(buffer, 0, 512, 0);
        const slice = buffer.subarray(0, bytesRead);
        if (slice.includes(0)) {
            return false;
        }
        const start = slice.toString('utf8').trim().toLowerCase();
        return !(
            start.startsWith('<!doctype html') ||
            start.startsWith('<html') ||
            start.startsWith('<svg') ||
            start.startsWith('<?xml')
        );
    } finally {
        await handle.close();
    }
};

export const detectSafeMime = async (
    filePath: string,
    allowedTypes: string[] = ALLOWED_MIME_TYPES[FileType.ALL]
): Promise<string> => {
    const { fileTypeFromFile } = await loadFileType();
    const type = await fileTypeFromFile(filePath);

    if (!type) {
        const allowsText = allowedTypes.includes('text/plain') || allowedTypes.includes('text/csv');
        if (allowsText && await looksLikePlainText(filePath)) {
            return allowedTypes.includes('text/csv') && filePath.toLowerCase().endsWith('.csv')
                ? 'text/csv'
                : 'text/plain';
        }
        throw new FileValidationError('No se pudo verificar el tipo real del archivo');
    }

    if (type.mime === 'image/svg+xml' || type.ext === 'svg') {
        throw new FileValidationError('SVG no está permitido');
    }

    if (!allowedTypes.includes(type.mime)) {
        throw new FileValidationError(`Tipo de archivo no permitido: ${type.mime}`);
    }

    return type.mime;
};

export const normalizeUploadedFile = async (file: Express.Multer.File): Promise<void> => {
    const detectedMime = await detectSafeMime(file.path);
    const claimed = file.mimetype === 'image/jpg' ? 'image/jpeg' : file.mimetype;
    if (claimed !== detectedMime && claimed !== 'text/csv' && claimed !== 'text/plain') {
        throw new FileValidationError('El tipo declarado no coincide con el contenido del archivo');
    }
    file.mimetype = detectedMime;
};

/**
 * Sanitiza el nombre del archivo
 */
export const sanitizeFilename = (filename: string): string => {
    // Eliminar caracteres peligrosos y rutas
    return filename
        .replace(/[/\\?%*:|"<>]/g, '-')
        .replace(/\.{2,}/g, '.')
        .trim();
};

// ============================================================================
// Utilidades
// ============================================================================

/**
 * Formatea bytes a unidad legible
 */
export const formatBytes = (bytes: number, decimals: number = 2): string => {
    if (bytes === 0) return '0 Bytes';
    
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    
    return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
};

/**
 * Obtiene la extensión de un archivo
 */
export const getFileExtension = (filename: string): string => {
    return path.extname(filename).toLowerCase().slice(1);
};

/**
 * Determina la categoría de un archivo por su MIME type
 */
export const getFileCategory = (mimeType: string): 'image' | 'document' | 'other' => {
    if (ALLOWED_MIME_TYPES[FileType.IMAGE].includes(mimeType)) {
        return 'image';
    }
    if (ALLOWED_MIME_TYPES[FileType.DOCUMENT].includes(mimeType)) {
        return 'document';
    }
    return 'other';
};
