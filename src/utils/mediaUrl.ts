import HashService from '../storage/HashService';
import { getJwtSecret } from '../config/security';

const DEFAULT_TTL = 3600;

function normalizeRelativePath(relativePath: string): string {
    return relativePath.replace(/\\/g, '/').replace(/^\/+/, '');
}

export function getMediaTtlSeconds(): number {
    const parsed = Number(process.env.MEDIA_URL_TTL_SECONDS || DEFAULT_TTL);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TTL;
}

export function buildSignedMediaUrl(relativePath: string): string {
    const path = normalizeRelativePath(relativePath);
    const expiresAt = Math.floor(Date.now() / 1000) + getMediaTtlSeconds();
    const sig = HashService.generateSignature(path, getJwtSecret(), expiresAt);
    return `/media/${path}?expires=${expiresAt}&sig=${sig}`;
}

export function mediaPathForStoredFile(
    storedName: string,
    category: 'image' | 'document' | 'other',
    variant: 'original' | 'thumbnail' | 'optimized' = 'original'
): string {
    if (category === 'image') {
        if (variant === 'thumbnail') {
            return `images/thumbnails/${storedName}`;
        }
        if (variant === 'optimized') {
            return `images/optimized/${storedName}`;
        }
        return `images/originals/${storedName}`;
    }
    if (category === 'document') {
        return `documents/${storedName}`;
    }
    return `other/${storedName}`;
}
