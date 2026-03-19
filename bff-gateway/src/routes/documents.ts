import type { FastifyPluginAsync } from 'fastify';
import { readDocumentHandler } from '../controllers/documents.controller.js';

const documentsPlugin: FastifyPluginAsync = async (app) => {
  app.post('/read', {
    schema: {
      tags: ['Documents'],
      summary: 'Read and extract text from a document',
      description:
        'Fetches a document by its `fileReference` and extracts its plain-text content. ' +
        'Optionally extracts tables as structured data and applies OCR for the given language. ' +
        'Supported file types depend on the underlying document reader service.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
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
      response: {
        200: {
          description: 'Document read and text extracted successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              description: 'Extracted document content returned by the document reader service.',
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
                  description: 'Additional document metadata returned by the reader service (e.g. page count, author).',
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
  }, readDocumentHandler);
};

export default documentsPlugin;
