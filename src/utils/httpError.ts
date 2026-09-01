import { Response } from 'express';

export class HttpError extends Error {
    public readonly statusCode: number;
    public readonly extra: Record<string, unknown>;

    constructor(statusCode: number, message: string, extra: Record<string, unknown> = {}) {
        super(message);
        this.name = 'HttpError';
        this.statusCode = statusCode;
        this.extra = extra;
    }
}

export function sendError(res: Response, error: unknown, fallback: string) {
    if (error instanceof HttpError) {
        return res.status(error.statusCode).json({ error: error.message, ...error.extra });
    }
    console.error(fallback, error);
    return res.status(500).json({ error: fallback });
}
