/**
 * @file search.ts — Semantic search routes for the Gateway API.
 *
 * Proxies search requests to the Search Base service after authentication.
 * All routes are protected by Firebase auth and rate limiting.
 */
import type { FastifyPluginAsync } from 'fastify';
import { searchHandler } from '../controllers/search.controller.js';

const searchPlugin: FastifyPluginAsync = async (app) => {
  app.post('/', {
    schema: {
      tags: ['Search'],
      summary: 'Perform a semantic search',
      description:
        'Executes a semantic search against the resume content index. ' +
        'Returns ranked results that best match the provided natural-language `query`. ' +
        'Use `filters` to narrow results by metadata fields, ' +
        '`limit` to control page size (default 10, max 100), and `offset` for pagination.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
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
      response: {
        200: {
          description: 'Search completed successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              description: 'Search result payload returned by the search backend.',
              properties: {
                results: {
                  type: 'array',
                  description: 'Ranked list of search result items.',
                  items: {
                    type: 'object',
                    properties: {
                      id: {
                        type: 'string',
                        description: 'Unique identifier of the matched resume.',
                        example: 'resume-abc123',
                      },
                      score: {
                        type: 'number',
                        description: 'Relevance score (higher is more relevant).',
                        example: 0.95,
                      },
                      data: {
                        type: 'object',
                        additionalProperties: true,
                        description: 'Resume metadata and extracted fields.',
                      },
                    },
                  },
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
            },
            meta: {
              type: 'object',
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
          },
        },
        400: {
          description: 'Request body failed validation.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Validation error' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
              },
            },
          },
        },
        401: {
          description: 'Missing or invalid Firebase ID token.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'UNAUTHORIZED' },
                message: { type: 'string', example: 'Missing or invalid Authorization header' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
              },
            },
          },
        },
        403: {
          description: 'Authenticated user does not have access to this application.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'FORBIDDEN' },
                message: { type: 'string', example: 'User does not have access to this application' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
              },
            },
          },
        },
        500: {
          description: 'An unexpected server-side error occurred.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'INTERNAL_ERROR' },
                message: { type: 'string', example: 'An unexpected error occurred' },
              },
            },
            meta: {
              type: 'object',
              properties: {
                timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
              },
            },
          },
        },
      },
    },
  }, searchHandler);
};

export default searchPlugin;
