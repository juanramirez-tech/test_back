import './config/processTimezone';
import express from 'express';
import type { Server } from 'http';
import dotenv from 'dotenv';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import morgan from 'morgan';
import sequelize, { waitForDatabase } from './config/database';
import './models';
import mainRoutes from './main_routes';
import seed from './seed';
import { assertSecureEnv, configureTrustProxy, isProduction, parseCorsOrigins, shouldAlterSchema } from './config/security';
import { setupDocs } from './docs/swagger';
import { startHoldExpiryJob, stopHoldExpiryJob } from './services/holdExpiryService';
import { redactRequestUrl } from './utils/logRedact';

dotenv.config();
assertSecureEnv();

const app = express();
const port = process.env.PORT || 3000;
configureTrustProxy(app);
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Demasiadas solicitudes, por favor intenta más tarde' }
});

app.disable('x-powered-by');
app.use(helmet({
    contentSecurityPolicy: isProduction()
        ? { directives: { defaultSrc: ["'none'"], frameAncestors: ["'none'"] } }
        : false,
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: isProduction() ? 'same-origin' : 'cross-origin' },
    referrerPolicy: { policy: 'no-referrer' },
}));
morgan.token('url', (req) => {
    const expressReq = req as express.Request;
    return redactRequestUrl(expressReq.originalUrl || expressReq.url || '');
});
app.use(morgan(isProduction() ? 'combined' : 'dev'));
app.use(cors({
    origin: parseCorsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'auth', 'X-Access-Code'],
    exposedHeaders: ['Content-Disposition']
}));

app.use(express.json({ limit: '100kb' }));
app.use(express.urlencoded({ extended: true, limit: '100kb' }));

app.get('/health', async (_req, res) => {
    try {
        await sequelize.authenticate();
        return res.status(200).json({ status: 'ok' });
    } catch {
        return res.status(503).json({ error: 'Servicio no disponible' });
    }
});

app.use(apiLimiter);
const docsEnabled = setupDocs(app);
app.use('/', mainRoutes);

app.get('/', (_req, res) => {
    res.send('¡Hola Mundo!');
});

function listen(): Server {
    const server = app.listen(port, () => {
        console.log(`Server running on port ${port}`);
        if (docsEnabled) {
            console.log(`Docs: http://localhost:${port}/docs`);
        }
    });

    const shutdown = (signal: string) => {
        console.log(`${signal}: cerrando...`);
        server.close((closeError) => {
            void (async () => {
                await stopHoldExpiryJob();
                await sequelize.close();
                process.exit(closeError ? 1 : 0);
            })();
        });
        setTimeout(() => process.exit(1), 10_000).unref();
    };

    process.once('SIGTERM', () => shutdown('SIGTERM'));
    process.once('SIGINT', () => shutdown('SIGINT'));
    return server;
}

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
        listen();
    })
    .catch((error) => {
        console.error('No se pudo conectar a la base de datos:', error);
        process.exit(1);
    });
