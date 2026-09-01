import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, JwtPayload } from '../config/security';

const jwtMiddleware = (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('Authorization');

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(401).json({ message: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
        if (!decoded?.id || !decoded?.role) {
            return res.status(401).json({ message: 'Token no válido.' });
        }
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Token no válido.' });
    }
};

export default jwtMiddleware;
