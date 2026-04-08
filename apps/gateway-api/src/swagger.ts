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
        title: 'Elastic Resume Base Gateway',
        version: '1.0.0',
        description:
          'Backend For Frontend gateway that coordinates Firebase Auth, user management, ' +
          'resume ingestion/generation, semantic search, and document reading. ' +
          'All routes under /api/v1 require a valid Firebase ID token.',
      },
      servers: [{ url: '/', description: 'Current server' }],
      tags: [
        { name: 'Health', description: 'Liveness and readiness probes for the Gateway service.' },
        { name: 'Me', description: 'Authenticated user self-service endpoints.' },
        { name: 'Users', description: 'User management — CRUD operations on user accounts.' },
        { name: 'Pre-Approved Users', description: 'Management of the pre-approved users list (admin only).' },
        { name: 'Resumes', description: 'Resume ingestion and generation jobs.' },
        { name: 'Search', description: 'Semantic search across resume content.' },
        { name: 'Documents', description: 'Document reading and text extraction.' },
        { name: 'Notifications', description: 'User and system notification management.' },
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
            description: 'Firebase Auth user record enriched with role and enable status from the users-api.',
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
            description: 'Pre-approved user record.',
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
          CreatePreApprovedRequest: {
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
          UpdateUserRequest: {
            type: 'object',
            description: 'Request payload for partially updating an existing user.',
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
            description: 'Paginated list of user records.',
            properties: {
              users: {
                type: 'array',
                description: 'Array of user records on this page.',
                items: { '$ref': '#/components/schemas/UserRecord' },
              },
              pageToken: {
                type: 'string',
                description: 'Pagination cursor. Absent when there are no more pages.',
                example: 'eyJhbGciOiJSUzI1NiJ9...',
              },
            },
            required: ['users'],
          },
          IngestRequest: {
            type: 'object',
            description: 'Request payload for triggering a resume ingest job.',
            properties: {
              sheetId: {
                type: 'string',
                description: 'Google Sheets file ID to ingest resumes from. One of `sheetId` or `batchId` is required.',
                example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
              },
              batchId: {
                type: 'string',
                description: 'Identifier of a pre-defined ingestion batch. One of `sheetId` or `batchId` is required.',
                example: 'batch-2026-q1',
              },
              metadata: {
                type: 'object',
                additionalProperties: true,
                description: 'Arbitrary key/value pairs to attach to the ingest job.',
                example: { campaign: 'spring-2026', owner: 'jane.doe@example.com' },
              },
            },
          },
          IngestResponse: {
            type: 'object',
            description: 'Result of a successfully enqueued resume ingest job.',
            properties: {
              jobId: {
                type: 'string',
                description: 'Unique identifier for the submitted ingest job.',
                example: 'job-7f3c9a2e-1b4d-4e8f-a1c3-0d2e5b6f7890',
              },
              status: {
                type: 'string',
                description: 'Current status of the ingest job.',
                example: 'accepted',
              },
              acceptedAt: {
                type: 'string',
                format: 'date-time',
                description: 'ISO-8601 timestamp when the job was accepted.',
                example: '2026-01-15T10:30:00.000Z',
              },
            },
            required: ['jobId', 'status', 'acceptedAt'],
          },
          GenerateRequest: {
            type: 'object',
            description: 'Request payload for generating a resume file.',
            required: ['language', 'format'],
            properties: {
              language: {
                type: 'string',
                description: 'BCP-47 language code for the generated resume (e.g. `en`, `pt-BR`).',
                example: 'en',
              },
              format: {
                type: 'string',
                enum: ['pdf', 'docx', 'html'],
                description: 'Primary output file format.',
                example: 'pdf',
              },
              outputFormats: {
                type: 'array',
                items: { type: 'string', enum: ['pdf', 'docx', 'html'] },
                description: 'Additional output formats to generate alongside the primary format.',
                example: ['docx'],
              },
            },
          },
          GenerateResponse: {
            type: 'object',
            description: 'Result of a successfully enqueued resume generation job.',
            properties: {
              jobId: {
                type: 'string',
                description: 'Unique identifier for the submitted generation job.',
                example: 'job-1a2b3c4d-5e6f-7890-abcd-ef1234567890',
              },
              status: {
                type: 'string',
                description: 'Current status of the generation job.',
                example: 'accepted',
              },
              downloadUrl: {
                type: 'string',
                format: 'uri',
                description: 'URL to download the generated resume file, if immediately available.',
                example: 'https://storage.example.com/resumes/resume-123.pdf',
              },
              driveLink: {
                type: 'string',
                format: 'uri',
                description: 'Google Drive link to the generated resume file, if applicable.',
                example: 'https://drive.google.com/file/d/1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
              },
            },
            required: ['jobId', 'status'],
          },
          SearchRequest: {
            type: 'object',
            description: 'Request payload for a semantic search against the resume content index.',
            required: ['query'],
            properties: {
              query: {
                type: 'string',
                description: 'Natural-language search query (1–1000 characters).',
                example: 'software engineer with React and Node.js experience',
              },
              filters: {
                type: 'object',
                additionalProperties: true,
                description: 'Optional key/value pairs to filter results by resume metadata fields.',
                example: { language: 'en', year: 2026 },
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of results to return (1–100).',
                example: 10,
              },
              offset: {
                type: 'integer',
                description: 'Number of results to skip for pagination.',
                example: 0,
              },
            },
          },
          SearchResult: {
            type: 'object',
            description: 'A single ranked item returned by the semantic search.',
            properties: {
              id: {
                type: 'string',
                description: 'Unique identifier of the matched resume.',
                example: 'resume-abc123',
              },
              score: {
                type: 'number',
                description: 'Relevance score — higher is more relevant.',
                example: 0.95,
              },
              data: {
                type: 'object',
                additionalProperties: true,
                description: 'Resume metadata and extracted fields.',
              },
            },
            required: ['id', 'score', 'data'],
          },
          SearchResponse: {
            type: 'object',
            description: 'Result set returned by the semantic search endpoint.',
            properties: {
              results: {
                type: 'array',
                description: 'Ranked list of search result items.',
                items: { '$ref': '#/components/schemas/SearchResult' },
              },
              total: {
                type: 'integer',
                description: 'Total number of matching results in the index.',
                example: 42,
              },
              query: {
                type: 'string',
                description: 'The search query as echoed by the search backend.',
                example: 'software engineer with React and Node.js experience',
              },
            },
            required: ['results', 'total', 'query'],
          },
          DocumentReadRequest: {
            type: 'object',
            description: 'Request payload for reading and extracting text from a document.',
            required: ['fileReference'],
            properties: {
              fileReference: {
                type: 'string',
                description: 'Identifier or URL of the document to read (e.g. a Google Drive file ID or a storage URL).',
                example: '1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgVE2upms',
              },
              options: {
                type: 'object',
                description: 'Optional extraction settings.',
                properties: {
                  extractTables: {
                    type: 'boolean',
                    description: 'When `true`, tables in the document are extracted as structured data.',
                    example: false,
                  },
                  language: {
                    type: 'string',
                    description: 'BCP-47 language code hint for OCR (e.g. `en`, `pt`).',
                    example: 'en',
                  },
                },
              },
            },
          },
          DocumentReadResponse: {
            type: 'object',
            description: 'Extracted content returned by the document reader service.',
            properties: {
              text: {
                type: 'string',
                description: 'Full plain-text content extracted from the document.',
                example: 'Jane Doe\nSoftware Engineer\n\nExperience:\n- Acme Corp (2020–2026)...',
              },
              tables: {
                type: 'array',
                description: 'Extracted tables, present only when `options.extractTables` is `true`.',
                items: { type: 'object', additionalProperties: true },
              },
              metadata: {
                type: 'object',
                additionalProperties: true,
                description: 'Additional document metadata returned by the reader service.',
              },
            },
            required: ['text'],
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
                example: 'Resource not found',
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
