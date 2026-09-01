import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import sequelize from './config/database';
import './models';
import mainRoutes from './main_routes';
import { serveSignedMedia } from './routes/media';
import seed from './seed';
import { getCleanupService } from './storage';
import { assertSecureEnv, isProduction, parseCorsOrigins } from './config/security';

dotenv.config();
assertSecureEnv();

const app = express();
const port = process.env.PORT || 3000;
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, por favor intenta más tarde' }
});

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'cross-origin' },
}));
app.use(morgan(isProduction() ? 'combined' : 'dev'));
app.use(cors({
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'auth'],
    exposedHeaders: ['Content-Disposition']
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.use(apiLimiter);
app.use('/media', ((req, res, next) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') {
        return res.status(405).json({ error: 'Método no permitido' });
    }
    return serveSignedMedia(req, res).catch(next);
}) as express.RequestHandler);
app.use('/', mainRoutes);

app.get('/', (req, res) => {
    res.send('¡Hola Mundo!');
});

sequelize
    .sync({ alter: process.env.DB_SYNC_ALTER === 'true' })
    .then(async () => {
        await seed();

        const cleanup = getCleanupService();
        cleanup.startScheduledCleanup(6 * 60 * 60 * 1000);

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
        });
    })
    .catch((error) => {
        console.error('No se pudo conectar a la base de datos:', error);
        process.exit(1);
    });
