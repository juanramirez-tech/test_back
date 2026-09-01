import express from 'express';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import User from '../../models/users';
import validateRequired from '../../middlewares/validateRequired';
import { getJwtSecret } from '../../config/security';

const router = express.Router();

const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiados intentos de inicio de sesión, intenta más tarde' }
});

const DUMMY_HASH = '$2b$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy';

router.post('/', loginLimiter, validateRequired(['email', 'password']), async (req, res) => {
    try {
        const email = typeof req.body.email === 'string' ? req.body.email.trim() : '';
        const password = typeof req.body.password === 'string' ? req.body.password : '';

        const user = await User.unscoped().findOne({ where: { email } });

        if (!user) {
            await bcrypt.compare(password, DUMMY_HASH);
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const passwordMatch = await bcrypt.compare(password, user.password);
        if (!passwordMatch || user.status !== 'active') {
            return res.status(401).json({ error: 'Credenciales inválidas' });
        }

        const token = jwt.sign(
            { id: Number(user.id), email: user.email, role: user.role },
            getJwtSecret(),
            { expiresIn: '7h', algorithm: 'HS256' }
        );

        return res.status(200).json({ message: '¡Bienvenido!', token });
    } catch (error) {
        console.error('Error al iniciar sesión:', error);
        return res.status(500).json({ error: 'Error al iniciar sesión' });
    }
});

export default router;
