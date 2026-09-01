import fs from 'fs/promises';
import path from 'path';
import { getStorageProvider } from './LocalStorageProvider';

/**
 * Configuración del servicio de limpieza
 */
interface CleanupConfig {
    tempMaxAgeMs: number;      // Edad máxima de archivos temporales
    orphanCheckEnabled: boolean; // Verificar archivos huérfanos
    dryRun: boolean;           // Solo reportar, no eliminar
}

/**
 * Resultado de una operación de limpieza
 */
interface CleanupResult {
    tempFilesDeleted: number;
    orphanFilesDeleted: number;
    spaceReclaimed: number;    // bytes
    errors: string[];
}

/**
 * Configuración por defecto
 */
const DEFAULT_CONFIG: CleanupConfig = {
    tempMaxAgeMs: 24 * 60 * 60 * 1000, // 24 horas
    orphanCheckEnabled: true,
    dryRun: false
};

/**
 * Servicio de limpieza automática de archivos
 * Gestiona archivos temporales, huérfanos y mantenimiento general
 */
class CleanupService {
    private config: CleanupConfig;
    private isRunning: boolean = false;
    private intervalId: NodeJS.Timeout | null = null;

    constructor(config: Partial<CleanupConfig> = {}) {
        this.config = { ...DEFAULT_CONFIG, ...config };
    }

    /**
     * Ejecuta limpieza completa
     */
    async runCleanup(): Promise<CleanupResult> {
        if (this.isRunning) {
            return {
                tempFilesDeleted: 0,
                orphanFilesDeleted: 0,
                spaceReclaimed: 0,
                errors: ['Cleanup already running']
            };
        }

        this.isRunning = true;
        const result: CleanupResult = {
            tempFilesDeleted: 0,
            orphanFilesDeleted: 0,
            spaceReclaimed: 0,
            errors: []
        };

        try {
            // Limpiar archivos temporales
            const tempResult = await this.cleanupTempFiles();
            result.tempFilesDeleted = tempResult.count;
            result.spaceReclaimed += tempResult.size;

            console.log(`[Cleanup] Temp files cleaned: ${tempResult.count}, space: ${this.formatBytes(tempResult.size)}`);
        } catch (error) {
            const errorMsg = error instanceof Error ? error.message : 'Unknown error';
            result.errors.push(`Temp cleanup error: ${errorMsg}`);
        }

        this.isRunning = false;
        return result;
    }

    /**
     * Limpia archivos temporales antiguos
     */
    private async cleanupTempFiles(): Promise<{ count: number; size: number }> {
        const storage = getStorageProvider();
        const tempDir = path.join(storage.getBasePath(), 'temp');
        let count = 0;
        let size = 0;

        try {
            const files = await fs.readdir(tempDir);
            const now = Date.now();

            for (const file of files) {
                const filePath = path.join(tempDir, file);
                
                try {
                    const stat = await fs.stat(filePath);
                    
                    if (now - stat.mtimeMs > this.config.tempMaxAgeMs) {
                        if (!this.config.dryRun) {
                            await fs.unlink(filePath);
                        }
                        count++;
                        size += stat.size;
                    }
                } catch (err) {
                    // Ignorar errores de archivos individuales
                    continue;
                }
            }
        } catch (error) {
            // El directorio temp puede no existir
            if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
                throw error;
            }
        }

        return { count, size };
    }

    /**
     * Busca archivos huérfanos (no referenciados en la base de datos)
     * Nota: Esto requiere integración con el modelo File
     */
    async findOrphanFiles(registeredHashes: Set<string>): Promise<string[]> {
        const storage = getStorageProvider();
        const basePath = storage.getBasePath();
        const orphans: string[] = [];

        const dirsToCheck = [
            path.join(basePath, 'images', 'originals'),
            path.join(basePath, 'documents'),
            path.join(basePath, 'other')
        ];

        for (const dir of dirsToCheck) {
            try {
                const files = await fs.readdir(dir);
                
                for (const file of files) {
                    const filePath = path.join(dir, file);
                    // Aquí verificaríamos contra la base de datos
                    // Por ahora solo listamos los archivos
                    orphans.push(filePath);
                }
            } catch {
                // Directorio no existe, continuar
            }
        }

        return orphans;
    }

    /**
     * Inicia limpieza programada
     */
    startScheduledCleanup(intervalMs: number = 6 * 60 * 60 * 1000): void {
        if (this.intervalId) {
            console.log('[Cleanup] Scheduled cleanup already running');
            return;
        }

        console.log(`[Cleanup] Starting scheduled cleanup every ${intervalMs / 1000 / 60} minutes`);
        
        // Ejecutar inmediatamente
        this.runCleanup().catch(console.error);

        // Programar ejecuciones futuras
        this.intervalId = setInterval(() => {
            this.runCleanup().catch(console.error);
        }, intervalMs);
    }

    /**
     * Detiene limpieza programada
     */
    stopScheduledCleanup(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            console.log('[Cleanup] Scheduled cleanup stopped');
        }
    }

    /**
     * Formatea bytes a unidad legible
     */
    private formatBytes(bytes: number): string {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }

    /**
     * Obtiene estadísticas de uso de disco
     */
    async getDiskUsage(): Promise<{
        images: { originals: number; thumbnails: number; optimized: number };
        documents: number;
        other: number;
        temp: number;
        total: number;
    }> {
        const storage = getStorageProvider();
        const basePath = storage.getBasePath();

        const calculateDirSize = async (dirPath: string): Promise<number> => {
            let size = 0;
            try {
                const files = await fs.readdir(dirPath);
                for (const file of files) {
                    const filePath = path.join(dirPath, file);
                    const stat = await fs.stat(filePath);
                    size += stat.size;
                }
            } catch {
                // Directorio no existe
            }
            return size;
        };

        const [originals, thumbnails, optimized, documents, other, temp] = await Promise.all([
            calculateDirSize(path.join(basePath, 'images', 'originals')),
            calculateDirSize(path.join(basePath, 'images', 'thumbnails')),
            calculateDirSize(path.join(basePath, 'images', 'optimized')),
            calculateDirSize(path.join(basePath, 'documents')),
            calculateDirSize(path.join(basePath, 'other')),
            calculateDirSize(path.join(basePath, 'temp'))
        ]);

        return {
            images: { originals, thumbnails, optimized },
            documents,
            other,
            temp,
            total: originals + thumbnails + optimized + documents + other + temp
        };
    }
}

// Instancia singleton
let cleanupInstance: CleanupService | null = null;

export const getCleanupService = (config?: Partial<CleanupConfig>): CleanupService => {
    if (!cleanupInstance) {
        cleanupInstance = new CleanupService(config);
    }
    return cleanupInstance;
};

export default CleanupService;
