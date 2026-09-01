import { Express } from 'express';
import swaggerUi from 'swagger-ui-express';
import { openApiSpec } from './openapi';

export function setupDocs(app: Express): void {
    app.get('/docs.json', (_req, res) => {
        res.json(openApiSpec);
    });

    app.use(
        '/docs',
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
}
