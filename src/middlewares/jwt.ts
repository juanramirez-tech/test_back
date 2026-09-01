import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret, JwtPayload } from '../config/security';
import User from '../models/users';

const jwtMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const header = req.header('Authorization');

    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    const token = header.slice('Bearer '.length).trim();
    if (!token) {
        return res.status(401).json({ error: 'Acceso denegado. Token no proporcionado.' });
    }

    try {
        const decoded = jwt.verify(token, getJwtSecret(), { algorithms: ['HS256'] }) as JwtPayload;
        if (!decoded?.id) {
            return res.status(401).json({ error: 'Token no válido.' });
        }

        const user = await User.findByPk(decoded.id);
        if (!user || user.status !== 'active') {
            return res.status(401).json({ error: 'Token no válido.' });
        }

        req.user = {
            id: Number(user.id),
            email: user.email,
            role: user.role,
        };
        next();
    } catch (error) {
        return res.status(401).json({ error: 'Token no válido.' });
    }
};

export default jwtMiddleware;
