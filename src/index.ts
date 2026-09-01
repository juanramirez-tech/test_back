import express from 'express';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import sequelize, { waitForDatabase } from './config/database';
import './models';
import mainRoutes from './main_routes';
import seed from './seed';
import { assertSecureEnv, isProduction, parseCorsOrigins, shouldAlterSchema } from './config/security';
import { setupDocs } from './docs/swagger';
import { startHoldExpiryJob } from './services/holdExpiryService';
import { redactRequestUrl } from './utils/logRedact';

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
morgan.token('url', (req) => redactRequestUrl(req.originalUrl || req.url || ''));
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
const docsEnabled = setupDocs(app);
app.use('/', mainRoutes);

app.get('/', (req, res) => {
    res.send('¡Hola Mundo!');
});

waitForDatabase()
    .then(() => {
        const alter = shouldAlterSchema();
        if (process.env.DB_SYNC_ALTER === 'true' && !alter) {
            console.warn('DB_SYNC_ALTER ignorado: no se altera el esquema en production');
        }
        return sequelize.sync({ alter });
    })
    .then(async () => {
        await seed();

        startHoldExpiryJob(60 * 1000);

        app.listen(port, () => {
            console.log(`Server running on port ${port}`);
            if (docsEnabled) {
                console.log(`Docs: http://localhost:${port}/docs`);
            }
        });
    })
    .catch((error) => {
        console.error('No se pudo conectar a la base de datos:', error);
        process.exit(1);
    });
