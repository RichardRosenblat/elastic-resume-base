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
          'Firestore and implements the BFF Authorization Logic (Google Drive + Firestore). ' +
          'All routes under /api/v1 require a valid Firebase ID token passed as a Bearer token.',
      },
      servers: [{ url: '/', description: 'Current server' }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes for the Users API service.' },
        { name: 'Users', description: 'CRUD operations for Firestore user documents and role resolution.' },
      ],
      components: {
        securitySchemes: {
          bearerAuth: {
            type: 'http',
            scheme: 'bearer',
            bearerFormat: 'JWT',
            description:
              'Firebase ID token obtained from the Firebase Authentication SDK. ' +
              'Pass it as `Authorization: Bearer <token>` on every protected request.',
          },
        },
      },
    },
  });

  await app.register(swaggerUi, {
    routePrefix: '/api/v1/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      displayRequestDuration: true,
      persistAuthorization: true,
    },
  });
}
