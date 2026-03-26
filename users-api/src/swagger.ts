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
        { name: 'Users', description: 'CRUD operations for Firestore user documents and BFF authorization logic.' },
        { name: 'Pre-Approved Users', description: 'Management of the pre-approved users list used during the onboarding flow.' },
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
        schemas: {
          UserRecord: {
            type: 'object',
            description: 'User document from the users Firestore collection.',
            properties: {
              uid: {
                type: 'string',
                description: 'Firebase UID — unique identifier for the user.',
                example: 'aB3dE5fG7hI9jK1l',
              },
              email: {
                type: 'string',
                format: 'email',
                description: "User's email address.",
                example: 'jane.doe@example.com',
              },
              role: {
                type: 'string',
                description: "Application-level role assigned to the user.",
                example: 'user',
              },
              enable: {
                type: 'boolean',
                description: 'Whether the user account is enabled.',
                example: true,
              },
            },
            required: ['uid', 'email', 'role', 'enable'],
          },
          PreApprovedUser: {
            type: 'object',
            description: 'Pre-approved user record from the pre_approved_users Firestore collection.',
            properties: {
              email: {
                type: 'string',
                format: 'email',
                description: "User's email address.",
                example: 'jane.doe@example.com',
              },
              role: {
                type: 'string',
                description: "Application-level role to assign when the user first logs in.",
                example: 'admin',
              },
            },
            required: ['email', 'role'],
          },
          AuthorizeRequest: {
            type: 'object',
            description: 'Request payload for the BFF authorization endpoint.',
            required: ['uid', 'email'],
            properties: {
              uid: {
                type: 'string',
                description: 'Firebase UID from the authentication token.',
                example: 'aB3dE5fG7hI9jK1l',
              },
              email: {
                type: 'string',
                format: 'email',
                description: "User's email address from the authentication token.",
                example: 'jane.doe@example.com',
              },
            },
          },
          AuthorizeResponse: {
            type: 'object',
            description: 'Authorization result returned to the BFF during the login flow.',
            properties: {
              role: {
                type: 'string',
                description: "User's application role.",
                example: 'user',
              },
              enable: {
                type: 'boolean',
                description: 'Whether the user is enabled to access protected routes.',
                example: true,
              },
            },
            required: ['role', 'enable'],
          },
          CreateUserRequest: {
            type: 'object',
            description: 'Request payload for creating a new user document.',
            required: ['uid', 'email', 'role', 'enable'],
            properties: {
              uid: {
                type: 'string',
                description: 'Firebase UID to assign to the new user.',
                example: 'aB3dE5fG7hI9jK1l',
              },
              email: {
                type: 'string',
                format: 'email',
                description: "User's email address.",
                example: 'jane.doe@example.com',
              },
              role: {
                type: 'string',
                description: "Application-level role.",
                example: 'user',
              },
              enable: {
                type: 'boolean',
                description: 'Whether the account should be enabled.',
                example: true,
              },
            },
          },
          UpdateUserRequest: {
            type: 'object',
            description: 'Request payload for partially updating an existing user document.',
            properties: {
              email: {
                type: 'string',
                format: 'email',
                description: 'Updated email address.',
                example: 'new.email@example.com',
              },
              role: {
                type: 'string',
                description: "Updated application-level role.",
                example: 'admin',
              },
              enable: {
                type: 'boolean',
                description: 'Enable or disable the account.',
                example: true,
              },
            },
          },
          AddPreApprovedRequest: {
            type: 'object',
            description: 'Request payload for adding a user to the pre-approved list.',
            required: ['email', 'role'],
            properties: {
              email: {
                type: 'string',
                format: 'email',
                description: 'Email address to pre-approve.',
                example: 'jane.doe@example.com',
              },
              role: {
                type: 'string',
                description: "Role to assign when the user first logs in.",
                example: 'admin',
              },
            },
          },
          UpdatePreApprovedRequest: {
            type: 'object',
            description: 'Request payload for updating a pre-approved user.',
            properties: {
              role: {
                type: 'string',
                description: "Updated role to assign.",
                example: 'user',
              },
            },
          },
          ListUsersResponse: {
            type: 'object',
            description: 'Paginated list of user documents.',
            properties: {
              users: {
                type: 'array',
                description: 'Array of user documents on this page.',
                items: { '$ref': '#/components/schemas/UserRecord' },
              },
              pageToken: {
                type: 'string',
                description: 'Cursor to pass as pageToken to retrieve the next page. Absent when there are no more pages.',
                example: 'eyJsYXN0VWlkIjoiYUIzZEU1ZkcifQ==',
              },
            },
            required: ['users'],
          },
          ResponseMeta: {
            type: 'object',
            description: 'Standard response metadata included in every API response envelope.',
            properties: {
              correlationId: {
                type: 'string',
                description: 'Request correlation ID for distributed tracing.',
                example: 'req-abc123',
              },
              timestamp: {
                type: 'string',
                format: 'date-time',
                description: 'ISO-8601 timestamp when the response was generated.',
                example: '2026-01-15T10:30:00.000Z',
              },
            },
          },
          ErrorDetail: {
            type: 'object',
            description: 'Machine-readable error details included in error responses.',
            properties: {
              code: {
                type: 'string',
                description: 'Machine-readable error code.',
                example: 'NOT_FOUND',
              },
              message: {
                type: 'string',
                description: 'Human-readable error message.',
                example: 'User not found',
              },
            },
            required: ['code', 'message'],
          },
          ErrorResponse: {
            type: 'object',
            description: 'Standard error response envelope returned for all 4xx and 5xx responses.',
            properties: {
              success: {
                type: 'boolean',
                description: 'Always false for error responses.',
                example: false,
              },
              error: { '$ref': '#/components/schemas/ErrorDetail' },
              meta: {
                type: 'object',
                description: 'Partial metadata (correlationId may be absent for early-failure errors).',
                properties: {
                  timestamp: {
                    type: 'string',
                    format: 'date-time',
                    example: '2026-01-15T10:30:00.000Z',
                  },
                },
              },
            },
            required: ['success', 'error'],
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
