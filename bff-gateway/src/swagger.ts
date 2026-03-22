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
        description:
          'Backend For Frontend gateway that coordinates Firebase Auth, user management, ' +
          'resume ingestion/generation, semantic search, and document reading. ' +
          'All routes under /api/v1 require a valid Firebase ID token.',
      },
      servers: [{ url: '/', description: 'Current server' }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes for the BFF Gateway service.' },
        { name: 'Me', description: 'Authenticated user self-service endpoints.' },
        { name: 'Users', description: 'User management — CRUD operations on user accounts.' },
        { name: 'Pre-Approved Users', description: 'Management of the pre-approved users list (admin only).' },
        { name: 'Resumes', description: 'Resume ingestion and generation jobs.' },
        { name: 'Search', description: 'Semantic search across resume content.' },
        { name: 'Documents', description: 'Document reading and text extraction.' },
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
