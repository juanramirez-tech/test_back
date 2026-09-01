import crypto from 'crypto';
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

export function assertSecureEnv(): void {
    getJwtSecret();
    getAuthGateSecret();
}

export function timingSafeStringEqual(a: string, b: string): boolean {
    const bufA = Buffer.from(a);
    const bufB = Buffer.from(b);
    if (bufA.length !== bufB.length) {
        return false;
    }
    return crypto.timingSafeEqual(bufA, bufB);
}

export function parseCorsOrigins(): string[] {
    const raw = process.env.CORS_ORIGINS || 'http://localhost:4200';
    return raw.split(',').map((origin) => origin.trim()).filter(Boolean);
}

export function validatePassword(password: unknown): string | null {
    if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
        return 'La contraseña debe tener entre 8 y 128 caracteres';
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
