import { Request, Response, NextFunction } from 'express';
import { getAuthGateSecret, timingSafeStringEqual } from '../config/security';

const auth = (req: Request, res: Response, next: NextFunction) => {
    let expected: string;
    try {
        expected = getAuthGateSecret();
    } catch {
        return res.status(500).json({ error: 'Servidor mal configurado' });
    }

    const authHeader = req.headers['auth'];
    const provided = Array.isArray(authHeader) ? authHeader[0] : authHeader;

    if (!provided || !timingSafeStringEqual(provided, expected)) {
        return res.status(401).json({ error: 'Acceso no autorizado' });
    }

    next();
};

export default auth;
