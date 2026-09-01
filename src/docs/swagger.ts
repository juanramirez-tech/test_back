import { Express } from 'express';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import { isDocsEnabled } from '../config/security';
import { openApiSpec } from './openapi';

const docsCsp = helmet({
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            scriptSrc: ["'self'", "'unsafe-inline'"],
            styleSrc: ["'self'", "'unsafe-inline'"],
            imgSrc: ["'self'", 'data:'],
            connectSrc: ["'self'"],
        },
    },
    crossOriginEmbedderPolicy: false,
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
});

export function setupDocs(app: Express): boolean {
    if (!isDocsEnabled()) {
        return false;
    }

    app.get('/docs.json', (_req, res) => {
        res.json(openApiSpec);
    });

    app.use(
        '/docs',
        docsCsp,
        swaggerUi.serve,
        swaggerUi.setup(openApiSpec, {
            explorer: true,
            customSiteTitle: 'API Reservas de Canchas',
            swaggerOptions: {
                persistAuthorization: true,
                displayRequestDuration: true,
                docExpansion: 'list',
                filter: true,
                tagsSorter: 'alpha',
            },
        })
    );

    return true;
}
