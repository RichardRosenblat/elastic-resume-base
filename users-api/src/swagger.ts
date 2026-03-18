import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Registers @fastify/swagger and @fastify/swagger-ui on the Fastify instance.
 * - Swagger UI: /api/v1/docs
 * - OpenAPI JSON spec: /api/v1/docs/json
 */
export async function setupSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Elastic Resume Base Users API',
        version: '1.0.0',
        description:
          'User management microservice. Provides CRUD operations for user records stored in ' +
          'Firestore and implements the BFF Authorization Logic (Google Drive + Firestore).',
      },
      servers: [{ url: '/', description: 'Current server' }],
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    uiConfig: { docExpansion: 'list' },
  });
}
