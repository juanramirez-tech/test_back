import crypto from 'crypto';
import type { Application } from 'express';
import dotenv from 'dotenv';

dotenv.config();

export const ALLOWED_ROLES = ['admin', 'user'] as const;
export const ALLOWED_STATUSES = ['active', 'inactive'] as const;
export type AppRole = (typeof ALLOWED_ROLES)[number];

export interface JwtPayload {
    id: number;
    email: string;
    role: string;
}

export function isProduction(): boolean {
    return process.env.NODE_ENV === 'production';
}

/** Swagger en development. En production solo si ENABLE_DOCS=true. */
export function isDocsEnabled(): boolean {
    if (process.env.ENABLE_DOCS === 'true') {
        return true;
    }
    if (process.env.ENABLE_DOCS === 'false') {
        return false;
    }
    return !isProduction();
}

/** alter=true solo en development y si se pide explícito. Nunca en production. */
export function shouldAlterSchema(): boolean {
    if (isProduction()) {
        return false;
    }
    return process.env.DB_SYNC_ALTER === 'true';
}

export function getJwtSecret(): string {
    const secret = process.env.JWT_SECRET || '';
    if (secret.length < 32) {
        throw new Error('JWT_SECRET debe tener al menos 32 caracteres aleatorios.');
    }
    return secret;
}

export function getAuthGateSecret(): string {
    const auth = process.env.AUTH || '';
    if (auth.length < 16) {
        throw new Error('AUTH debe tener al menos 16 caracteres.');
    }
    return auth;
}

export function getMediaHmacSecret(): string {
    const secret = process.env.MEDIA_HMAC_SECRET || '';
    if (secret.length < 32) {
        throw new Error('MEDIA_HMAC_SECRET debe tener al menos 32 caracteres aleatorios.');
    }
    if (secret === getJwtSecret()) {
        throw new Error('MEDIA_HMAC_SECRET debe ser distinto de JWT_SECRET.');
    }
    return secret;
}

export function assertSecureEnv(): void {
    getJwtSecret();
    getAuthGateSecret();

    const media = process.env.MEDIA_HMAC_SECRET || '';
    if (isProduction()) {
        getMediaHmacSecret();
        return;
    }
    if (media) {
        getMediaHmacSecret();
        return;
    }
    console.warn('MEDIA_HMAC_SECRET no configurado: las URLs de /media no se podrán firmar.');
}

export function timingSafeStringEqual(a: string, b: string): boolean {
    const digestA = crypto.createHash('sha256').update(a, 'utf8').digest();
    const digestB = crypto.createHash('sha256').update(b, 'utf8').digest();
    return crypto.timingSafeEqual(digestA, digestB);
}

export function parseCorsOrigins(): string[] {
    const raw = process.env.CORS_ORIGINS || 'http://localhost:4200';
    return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}

/**
 * Detrás de nginx/traefik, Express debe confiar N hops para que req.ip
 * (y el rate limit) usen el cliente real. Si Node está expuesto directo,
 * no lo actives: cualquiera podría falsificar X-Forwarded-For.
 */
export function configureTrustProxy(app: Application): void {
    const raw = (process.env.TRUST_PROXY || '').trim().toLowerCase();
    if (!raw || raw === 'false' || raw === '0') {
        return;
    }
    if (raw === 'true') {
        app.set('trust proxy', 1);
        return;
    }
    const hops = Number(raw);
    if (Number.isInteger(hops) && hops >= 1 && hops <= 5) {
        app.set('trust proxy', hops);
        return;
    }
    throw new Error('TRUST_PROXY debe ser false, true, o un número de hops entre 1 y 5.');
}

export function validatePassword(password: unknown): string | null {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return 'La contraseña debe tener entre 8 y 128 caracteres';
    }
    if (!/[A-Za-z]/.test(password) || !/\d/.test(password)) {
        return 'La contraseña debe incluir letras y números';
    }
    return null;
}

export function isAllowedRole(role: unknown): role is AppRole {
    return typeof role === 'string' && (ALLOWED_ROLES as readonly string[]).includes(role);
}

export function isAllowedStatus(status: unknown): boolean {
    return typeof status === 'string' && (ALLOWED_STATUSES as readonly string[]).includes(status);
}

export function toPublicUser(user: { toJSON?: () => Record<string, unknown> } | Record<string, unknown>) {
    const json = typeof (user as { toJSON?: () => Record<string, unknown> }).toJSON === 'function'
        ? (user as { toJSON: () => Record<string, unknown> }).toJSON()
        : { ...(user as Record<string, unknown>) };
    delete json.password;
    return json;
}
