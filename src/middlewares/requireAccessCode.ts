import { Request, Response, NextFunction } from 'express';

const ACCESS_CODE_HEADER = 'x-access-code';
const MIN_LENGTH = 16;

export function requireAccessCode(req: Request, res: Response, next: NextFunction) {
    const raw = req.header('X-Access-Code') ?? req.headers[ACCESS_CODE_HEADER];
    const accessCode = typeof raw === 'string' ? raw.trim() : '';

    if (!accessCode || accessCode.length < MIN_LENGTH) {
        return res.status(401).json({ error: 'Falta header X-Access-Code' });
    }

    req.accessCode = accessCode;
    next();
}
