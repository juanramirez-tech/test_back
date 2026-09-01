import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import { getStorageProvider } from '../storage';
import HashService from '../storage/HashService';
import { getMediaHmacSecret } from '../config/security';

const CONTENT_TYPES: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.avif': 'image/avif',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xls': 'application/vnd.ms-excel',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.txt': 'text/plain',
    '.csv': 'text/csv',
};

const INLINE_IMAGE_EXT = new Set(['.jpg', '.jpeg', '.png', '.gif', '.webp', '.avif']);

function resolveSafePath(basePath: string, relativePath: string): string | null {
    const normalized = path.normalize(relativePath).replace(/^([.][.](?:\/|\\|$))+/, '');
    const absolute = path.resolve(basePath, normalized);
    const root = path.resolve(basePath);
    if (absolute !== root && !absolute.startsWith(root + path.sep)) {
        return null;
    }
    if (absolute.includes(`${path.sep}temp${path.sep}`) || absolute.endsWith(`${path.sep}temp`)) {
        return null;
    }
    return absolute;
}

export const serveSignedMedia = async (req: Request, res: Response) => {
    try {
        const relativePath = decodeURIComponent(req.path.replace(/^\/+/, ''));
        const expires = Number(req.query.expires);
        const sig = typeof req.query.sig === 'string' ? req.query.sig : '';

        if (!relativePath || !sig || !Number.isFinite(expires)) {
            return res.status(401).json({ error: 'URL de archivo no válida' });
        }

        if (Math.floor(Date.now() / 1000) > expires) {
            return res.status(401).json({ error: 'URL de archivo expirada' });
        }

        const valid = HashService.verifySignature(relativePath, sig, getMediaHmacSecret(), expires);
        if (!valid) {
            return res.status(401).json({ error: 'Firma de archivo no válida' });
        }

        const storage = getStorageProvider();
        const filePath = resolveSafePath(storage.getBasePath(), relativePath);
        if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
            return res.status(404).json({ error: 'Archivo no encontrado' });
        }

        const ext = path.extname(filePath).toLowerCase();
        const contentType = CONTENT_TYPES[ext] || 'application/octet-stream';
        const disposition = INLINE_IMAGE_EXT.has(ext) ? 'inline' : 'attachment';

        res.setHeader('Content-Type', contentType);
        res.setHeader('X-Content-Type-Options', 'nosniff');
        res.setHeader('Content-Disposition', `${disposition}; filename="download${ext}"`);
        res.setHeader('Cache-Control', 'private, max-age=60');
        return res.sendFile(filePath);
    } catch (error) {
        console.error('Error serving media:', error);
        return res.status(500).json({ error: 'Error al servir archivo' });
    }
};
