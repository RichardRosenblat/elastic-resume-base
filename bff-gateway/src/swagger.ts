import swagger from '@fastify/swagger';
import swaggerUi from '@fastify/swagger-ui';
import type { FastifyInstance } from 'fastify';

/**
 * Registers @fastify/swagger and @fastify/swagger-ui on the Fastify instance.
 * - Swagger UI: /api/v1/docs
 * - OpenAPI JSON spec: /api/v1/docs/json
 * - Legacy JSON spec alias: /api/v1/docs.json
 */
export async function setupSwagger(app: FastifyInstance): Promise<void> {
  await app.register(swagger, {
    openapi: {
      info: {
        title: 'Elastic Resume Base BFF Gateway',
        version: '1.0.0',
        description: 'Backend For Frontend gateway API',
      },
      servers: [{ url: '/', description: 'Current server' }],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description: 'Firebase ID token',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    uiConfig: { docExpansion: 'list' },
  });
}
