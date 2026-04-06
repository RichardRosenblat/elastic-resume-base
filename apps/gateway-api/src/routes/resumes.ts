/**
 * @file resumes.ts — Resume ingestion and generation routes for the Gateway API.
 *
 * All routes are protected by Firebase authentication and rate limiting (applied
 * by the parent plugin in `routes/index.ts`).
 */
import type { FastifyPluginAsync } from 'fastify';
import { ingest, ingestUpload, generate } from '../controllers/resumes.controller.js';

const resumesPlugin: FastifyPluginAsync = async (app) => {
  app.post('/ingest', {
    schema: {
      tags: ['Resumes'],
      summary: 'Trigger a resume ingest job',
      description:
        'Enqueues an asynchronous ingest job that downloads and parses resume data from a ' +
        'Google Sheet or a batch identifier. Either `sheetId` or `batchId` must be supplied. ' +
        'Returns HTTP 202 immediately with a `jobId` that can be used to track progress.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
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
            description: 'Arbitrary key/value pairs to attach to the ingest job for tracking purposes.',
            example: { campaign: 'spring-2026', owner: 'jane.doe@example.com' },
          },
        },
      },
      response: {
        202: {
          description: 'Ingest job accepted and enqueued.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
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
                  description: 'ISO-8601 timestamp when the job was accepted by the downloader service.',
                  example: '2026-01-15T10:30:00.000Z',
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
          description: 'Request body failed validation (e.g. neither sheetId nor batchId provided).',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'Either sheetId or batchId must be provided' },
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
  }, ingest);

  // Register a no-op content-type parser for multipart/form-data so that the
  // raw upload stream is not buffered by Fastify and can be piped directly to
  // the ingestor service.
  app.addContentTypeParser('multipart/form-data', (_request, _payload, done) => {
    done(null);
  });

  app.post('/ingest/upload', {
    schema: {
      tags: ['Resumes'],
      summary: 'Trigger a resume ingest job from a file upload',
      description:
        'Upload an Excel (`.xlsx`, `.xls`, `.xlsm`) or CSV (`.csv`) file containing Google Drive ' +
        'links to resume files. The ingestor downloads each linked resume, extracts plain text, ' +
        'stores it in Firestore, and publishes a Pub/Sub message per ingested resume.\n\n' +
        'The request must be a `multipart/form-data` upload. Include the spreadsheet as the ' +
        '`file` field. Optional form fields control how the spreadsheet is parsed: `sheet_name` ' +
        '(Excel worksheet tab, defaults to first), `has_header_row` (whether row 1 is a header, ' +
        'default `true`), `link_column` (header name for the Drive-link column), ' +
        '`link_column_index` (1-based column number, required when `has_header_row` is `false`), ' +
        'and `metadata` (JSON object attached to every ingested resume).\n\n' +
        'Embedded cell hyperlinks (badges) in Excel files are extracted automatically.',
      security: [{ bearerAuth: [] }],
      consumes: ['multipart/form-data'],
      response: {
        200: {
          description: 'Ingestion completed. Returns counts of ingested resumes and any row-level errors.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                ingested: {
                  type: 'integer',
                  description: 'Number of resumes successfully ingested.',
                  example: 5,
                },
                errors: {
                  type: 'array',
                  description: 'Per-row errors encountered during ingestion.',
                  items: {
                    type: 'object',
                    properties: {
                      row: { type: 'integer', description: 'Row number in the spreadsheet (1-based).', example: 3 },
                      error: { type: 'string', description: 'Error description for this row.', example: 'Invalid Drive link' },
                    },
                  },
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
          description: 'Invalid request parameters, unsupported file format, or missing `multipart/form-data` content type.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'BAD_REQUEST' },
                message: { type: 'string', example: 'Expected multipart/form-data upload' },
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
        422: {
          description: 'Validation error — missing required fields or invalid form parameters.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            error: {
              type: 'object',
              properties: {
                code: { type: 'string', example: 'VALIDATION_ERROR' },
                message: { type: 'string', example: 'link_column_index is required when has_header_row is false' },
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
  }, ingestUpload);

  app.post('/:resumeId/generate', {
    schema: {
      tags: ['Resumes'],
      summary: 'Generate a resume file',
      description:
        'Triggers an asynchronous file generation job for the specified resume. ' +
        'Produces the resume in the requested `format` and `language`. ' +
        'Optionally produces additional formats via `outputFormats`. ' +
        'Returns HTTP 202 immediately with a `jobId` for tracking.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['resumeId'],
        properties: {
          resumeId: {
            type: 'string',
            description: 'Unique identifier of the resume to generate a file for.',
            example: 'resume-0a1b2c3d-4e5f-6789-abcd-ef0123456789',
          },
        },
      },
      body: {
        type: 'object',
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
      response: {
        202: {
          description: 'Generation job accepted and enqueued.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
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
                message: { type: 'string', example: 'resumeId is required' },
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
  }, generate);
};

export default resumesPlugin;
