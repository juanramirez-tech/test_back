import express, { Request, Response } from 'express';
import { upload, MulterFiles, validateFilePayload, handleMulterError, FileValidationError } from '../../utils/fileUtils';
import FileService from '../../services/fileService';
import { getCleanupService } from '../../storage';

const router = express.Router();

/**
 * Configuración de campos para upload
 */
const fileUploadFields = [
    { name: 'mainFile', maxCount: 1 },
    { name: 'additionalFiles', maxCount: 5 }
];

// ============================================================================
// CRUD de Archivos
// ============================================================================

/**
 * POST /files - Crear un nuevo archivo
 */
router.post('/', async (req: Request, res: Response) => {
    try {
        const uploadMiddleware = upload.fields(fileUploadFields);

        uploadMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({
                    error: err.message,
                    details: 'Los campos deben ser: mainFile (archivo único) y additionalFiles (múltiples archivos)'
                });
            }

            // Validación de nombre
            if (!req.body.name) {
                return res.status(400).json({ error: 'El nombre es requerido' });
            }

            // Validación de archivos
            const files = req.files as MulterFiles;
            if (!validateFilePayload(files)) {
                return res.status(400).json({ error: 'Debe incluir al menos un archivo' });
            }

            try {
                // Opciones de procesamiento
                const options = {
                    generateThumbnail: req.body.generateThumbnail !== 'false',
                    optimizeImage: req.body.optimizeImage !== 'false'
                };

                // Crear archivo usando el servicio
                const newFile = await FileService.createFile(req.body.name, files, options);

                return res.status(201).json({
                    message: 'Archivo creado exitosamente',
                    data: FileService.transformFileUrls(newFile.toJSON())
                });
            } catch (error) {
                console.error('Error al crear registro:', error);
                if (error instanceof FileValidationError) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: 'Error al crear registro' });
            }
        });
    } catch (error) {
        console.error('Error en el proceso:', error);
        return res.status(500).json({ error: 'Error en el proceso' });
    }
});

/**
 * GET /files - Obtener todos los archivos
 */
router.get('/', async (req: Request, res: Response) => {
    try {
        const files = await FileService.getAllFiles();

        // Transformar cada archivo para incluir URLs completas
        const transformedFiles = files.map(file =>
            FileService.transformFileUrls(file.toJSON())
        );

        return res.status(200).json({
            count: transformedFiles.length,
            data: transformedFiles
        });
    } catch (error) {
        console.error('Error al obtener archivos:', error);
        return res.status(500).json({ error: 'Error al obtener archivos' });
    }
});

/**
 * GET /files/stats - Obtener estadísticas de almacenamiento
 */
router.get('/stats', async (req: Request, res: Response) => {
    try {
        const stats = await FileService.getStorageStats();
        const cleanup = getCleanupService();
        const diskUsage = await cleanup.getDiskUsage();

        return res.status(200).json({
            stats,
            diskUsage
        });
    } catch (error) {
        console.error('Error al obtener estadísticas:', error);
        return res.status(500).json({ error: 'Error al obtener estadísticas' });
    }
});

/**
 * GET /files/:id - Obtener un archivo por ID
 */
router.get('/:id', async (req: Request, res: Response) => {
    try {
        const file = await FileService.getFileById(req.params.id);

        if (!file) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        return res.status(200).json(
            FileService.transformFileUrls(file.toJSON())
        );
    } catch (error) {
        console.error('Error al obtener archivo:', error);
        return res.status(500).json({ error: 'Error al obtener archivo' });
    }
});

/**
 * PUT /files/:id - Actualizar un archivo existente
 */
router.put('/:id', async (req: Request, res: Response) => {
    try {
        // Verificar que el archivo existe
        const fileExists = await FileService.getFileById(req.params.id);

        if (!fileExists) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        const uploadMiddleware = upload.fields(fileUploadFields);

        uploadMiddleware(req, res, async (err) => {
            if (err) {
                return res.status(400).json({ error: err.message });
            }

            const files = req.files as MulterFiles;

            try {
                // Opciones de procesamiento
                const options = {
                    generateThumbnail: req.body.generateThumbnail !== 'false',
                    optimizeImage: req.body.optimizeImage !== 'false'
                };

                const updatedFile = await FileService.updateFile(
                    req.params.id,
                    req.body.name,
                    files,
                    options
                );

                if (!updatedFile) {
                    return res.status(404).json({ error: 'Archivo no encontrado' });
                }

                return res.status(200).json({
                    message: 'Archivo actualizado correctamente',
                    data: FileService.transformFileUrls(updatedFile.toJSON())
                });
            } catch (error) {
                console.error('Error al actualizar:', error);
                if (error instanceof FileValidationError) {
                    return res.status(400).json({ error: error.message });
                }
                return res.status(500).json({ error: 'Error al actualizar' });
            }
        });
    } catch (error) {
        console.error('Error en el proceso:', error);
        return res.status(500).json({ error: 'Error en el proceso' });
    }
});

/**
 * DELETE /files/:id - Eliminar un archivo
 */
router.delete('/:id', async (req: Request, res: Response) => {
    try {
        const deleted = await FileService.deleteFile(req.params.id);

        if (!deleted) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        return res.status(200).json({
            success: true,
            message: 'Archivo eliminado correctamente'
        });
    } catch (error) {
        console.error('Error al eliminar archivo:', error);
        return res.status(500).json({ error: 'Error al eliminar archivo' });
    }
});

// ============================================================================
// Utilidades de Administración
// ============================================================================

/**
 * POST /files/cleanup - Ejecutar limpieza de archivos temporales
 */
router.post('/cleanup', async (req: Request, res: Response) => {
    try {
        const cleanup = getCleanupService();
        const result = await cleanup.runCleanup();

        return res.status(200).json({
            message: 'Limpieza ejecutada',
            result
        });
    } catch (error) {
        console.error('Error en limpieza:', error);
        return res.status(500).json({ error: 'Error en limpieza' });
    }
});

/**
 * POST /files/check-duplicate - Verificar si un hash ya existe
 */
router.post('/check-duplicate', async (req: Request, res: Response) => {
    try {
        const { hash } = req.body;

        if (!hash) {
            return res.status(400).json({ error: 'Hash requerido' });
        }

        const existing = await FileService.findDuplicate(hash);

        return res.status(200).json({
            isDuplicate: !!existing,
            existingFile: existing ? FileService.transformFileUrls(existing.toJSON()) : null
        });
    } catch (error) {
        console.error('Error al verificar duplicado:', error);
        return res.status(500).json({ error: 'Error al verificar duplicado' });
    }
});

router.use(handleMulterError);

export default router;
