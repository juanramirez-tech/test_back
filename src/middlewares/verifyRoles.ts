import { Request, Response, NextFunction } from 'express';

const verifyRoles = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Usuario no autenticado.' });
        }

        const hasPermission = allowedRoles.includes(req.user.role);

        if (!hasPermission) {
            return res.status(403).json({ error: 'No tienes permiso para acceder a este recurso.' });
        }

        next();
    };
};

export default verifyRoles;