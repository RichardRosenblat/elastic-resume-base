import type { FastifyPluginAsync } from 'fastify';
import {
  getAllowlistEntryHandler,
  upsertAllowlistEntryHandler,
  deleteAllowlistEntryHandler,
} from '../controllers/allowlist.controller.js';

/** Reusable schema for an allowlist entry document. */
const allowlistEntrySchema = {
  type: 'object',
  description: 'An entry in the pre-approved users allowlist.',
  properties: {
    email: {
      type: 'string',
      format: 'email',
      description: 'Email address (primary key, normalised to lowercase).',
      example: 'admin@company.com',
    },
    role: {
      type: 'string',
      description: "Role to assign when the user is onboarded (e.g. 'admin', 'user').",
      example: 'admin',
    },
  },
} as const;

/** Reusable schema for the standard response metadata. */
const responseMeta = {
  type: 'object',
  properties: {
    correlationId: {
      type: 'string',
      description: 'Request correlation ID.',
      example: 'req-abc123',
    },
    timestamp: {
      type: 'string',
      format: 'date-time',
      example: '2026-01-15T10:30:00.000Z',
    },
  },
} as const;

const validationErrorResponse = {
  description: 'Request body or parameters failed validation.',
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
    meta: { type: 'object', properties: { timestamp: { type: 'string', format: 'date-time' } } },
  },
} as const;

const notFoundResponse = {
  description: 'Allowlist entry not found.',
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'NOT_FOUND' },
        message: { type: 'string', example: 'No allowlist entry for email' },
      },
    },
    meta: { type: 'object', properties: { timestamp: { type: 'string', format: 'date-time' } } },
  },
} as const;

const internalErrorResponse = {
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
} as const;

const allowlistPlugin: FastifyPluginAsync = async (app) => {
  app.get('/:email', {
    schema: {
      tags: ['Allowlist'],
      summary: 'Get allowlist entry by email',
      description:
        'Retrieves a single pre-approved allowlist entry by email address. ' +
        'Used by the BFF gateway during the user onboarding flow.',
      params: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            description: 'Email address to look up.',
            example: 'admin@company.com',
          },
        },
      },
      response: {
        200: {
          description: 'Allowlist entry retrieved.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: allowlistEntrySchema,
            meta: responseMeta,
          },
        },
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, getAllowlistEntryHandler);

  app.post('/', {
    schema: {
      tags: ['Allowlist'],
      summary: 'Create or update an allowlist entry (idempotent upsert)',
      description:
        'Creates or updates a pre-approved allowlist entry. ' +
        'This operation is idempotent — posting the same email multiple times is safe.',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            description: 'Email address to pre-approve.',
            example: 'admin@company.com',
          },
          role: {
            type: 'string',
            description: "Role to assign on onboarding. Defaults to 'user'.",
            example: 'admin',
          },
        },
      },
      response: {
        200: {
          description: 'Allowlist entry created or updated.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: allowlistEntrySchema,
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        500: internalErrorResponse,
      },
    },
  }, upsertAllowlistEntryHandler);

  app.delete('/:email', {
    schema: {
      tags: ['Allowlist'],
      summary: 'Delete an allowlist entry',
      description:
        'Permanently removes a pre-approved allowlist entry by email. ' +
        'Called by the BFF gateway after a user is successfully onboarded.',
      params: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            description: 'Email address to remove from the allowlist.',
            example: 'admin@company.com',
          },
        },
      },
      response: {
        204: {
          description: 'Allowlist entry deleted. No response body.',
          type: 'null',
        },
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, deleteAllowlistEntryHandler);
};

export default allowlistPlugin;
