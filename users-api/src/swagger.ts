import swaggerJsdoc from 'swagger-jsdoc';
import * as swaggerUi from 'swagger-ui-express';
import { Express } from 'express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Elastic Resume Base Users API',
      version: '1.0.0',
      description:
        'User management microservice. Provides CRUD operations for user records stored in ' +
        'Firestore and implements the BFF Authorization Logic (Google Drive + Firestore).',
    },
    servers: [{ url: '/', description: 'Current server' }],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js'],
};

export const swaggerSpec = swaggerJsdoc(options);

/**
 * Registers Swagger UI and JSON spec endpoints on the Express app.
 */
export function setupSwagger(app: Express): void {
  app.use('/api/v1/docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
  app.get('/api/v1/docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });
}
