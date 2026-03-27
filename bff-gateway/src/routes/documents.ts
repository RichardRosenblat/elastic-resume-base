import type { FastifyPluginAsync } from 'fastify';
import { readDocumentHandler, ocrDocumentsHandler } from '../controllers/documents.controller.js';

const documentsPlugin: FastifyPluginAsync = async (app) => {
  // The `/ocr` endpoint receives raw multipart file uploads and forwards the
  // stream directly to the document reader service. Registering a no-op parser
  // for `multipart/form-data` prevents Fastify from attempting to buffer and
  // JSON-parse the body, leaving `request.raw` as an intact readable stream
  // that can be piped straight to the upstream service.
  app.addContentTypeParser('multipart/form-data', (_request, _payload, done) => {
    done(null);
  });

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

  app.post('/ocr', {
    schema: {
      tags: ['Documents'],
      summary: 'OCR: extract structured data from uploaded documents',
      description:
        'Accepts one or more document files (or ZIP archives containing documents) as a ' +
        '`multipart/form-data` upload. Each file is processed with Google Cloud Vision OCR ' +
        'and the extracted structured data is returned as an Excel workbook (.xlsx). ' +
        'Supported file types: `.pdf`, `.jpg`, `.jpeg`, `.png`, `.tiff`, `.tif`, `.bmp`, ' +
        '`.webp`, `.docx`. ZIP archives may contain any mix of the above. ' +
        'An optional `documentTypes` field (one document type string per `files` entry, in the ' +
        'same order) may be included to declare the Brazilian document type explicitly — e.g. ' +
        '`RG`, `BIRTH_CERTIFICATE`, `MARRIAGE_CERTIFICATE`, `WORK_CARD`, `PIS`, ' +
        '`PROOF_OF_ADDRESS`, `PROOF_OF_EDUCATION`. When provided, the document reader skips ' +
        'keyword-based classification and uses the supplied type directly. An empty string ' +
        'signals "auto-detect for this file". ZIP archive entries always use auto-detect.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          description: 'OCR completed. Returns the Excel workbook as a binary download.',
          content: {
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {
              schema: { type: 'string', format: 'binary' },
            },
          },
        },
        400: {
          description: 'Unsupported file type or invalid ZIP archive.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'BAD_REQUEST' },
                message: { type: 'string', example: 'Unsupported file type' },
              },
            },
            meta: { type: 'object', properties: { timestamp: { type: 'string', format: 'date-time' } } },
          },
        },
        422: {
          description: 'A file exceeds the maximum allowed size.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'File exceeds maximum size' },
              },
            },
            meta: { type: 'object', properties: { timestamp: { type: 'string', format: 'date-time' } } },
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
            meta: { type: 'object', properties: { timestamp: { type: 'string', format: 'date-time' } } },
          },
        },
      },
    },
  }, ocrDocumentsHandler);
};

export default documentsPlugin;
