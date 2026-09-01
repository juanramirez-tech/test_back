import crypto from 'crypto';
import fs from 'fs';
import { promisify } from 'util';
import { pipeline } from 'stream';

const pipelineAsync = promisify(pipeline);

/**
 * Servicio para cálculo de hashes y checksums de archivos
 * Utiliza SHA-256 para garantizar integridad y detectar duplicados
 */
class HashService {
    private static algorithm = 'sha256';

    /**
     * Calcula el hash SHA-256 de un archivo usando streaming
     * Eficiente para archivos grandes ya que no carga todo en memoria
     */
    static async calculateFileHash(filePath: string): Promise<string> {
        return new Promise((resolve, reject) => {
            const hash = crypto.createHash(this.algorithm);
            const stream = fs.createReadStream(filePath);

            stream.on('data', (data) => hash.update(data));
            stream.on('end', () => resolve(hash.digest('hex')));
            stream.on('error', (error) => reject(error));
        });
    }

    /**
     * Calcula el hash SHA-256 de un buffer
     */
    static calculateBufferHash(buffer: Buffer): string {
        return crypto.createHash(this.algorithm).update(buffer).digest('hex');
    }

    /**
     * Genera un hash corto para uso en nombres de archivo
     * Útil para crear identificadores únicos legibles
     */
    static generateShortHash(input: string, length: number = 8): string {
        const fullHash = crypto.createHash(this.algorithm).update(input).digest('hex');
        return fullHash.substring(0, length);
    }

    /**
     * Verifica si un archivo coincide con un hash dado
     */
    static async verifyFileHash(filePath: string, expectedHash: string): Promise<boolean> {
        const actualHash = await this.calculateFileHash(filePath);
        return actualHash === expectedHash;
    }

    /**
     * Genera un ID único para archivos
     * Combina timestamp + random para garantizar unicidad
     */
    static generateFileId(): string {
        const timestamp = Date.now().toString(36);
        const random = crypto.randomBytes(8).toString('hex');
        return `${timestamp}-${random}`;
    }

    /**
     * Genera una firma para URLs (para acceso privado/temporal)
     */
    static generateSignature(
        data: string, 
        secret: string, 
        expiresAt?: number
    ): string {
        const payload = expiresAt ? `${data}:${expiresAt}` : data;
        return crypto
            .createHmac('sha256', secret)
            .update(payload)
            .digest('hex');
    }

    /**
     * Verifica una firma de URL
     */
    static verifySignature(
        data: string,
        signature: string,
        secret: string,
        expiresAt?: number
    ): boolean {
        const expectedSignature = this.generateSignature(data, secret, expiresAt);
        
        // Verificación en tiempo constante para prevenir timing attacks
        if (signature.length !== expectedSignature.length) {
            return false;
        }
        
        return crypto.timingSafeEqual(
            Buffer.from(signature),
            Buffer.from(expectedSignature)
        );
    }
}

export default HashService;
