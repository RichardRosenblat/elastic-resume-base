import type { FastifyPluginAsync } from 'fastify';
import {
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  getPreApprovedHandler,
  addPreApprovedHandler,
  deletePreApprovedHandler,
  updatePreApprovedHandler,
} from '../controllers/users.controller.js';

/** Reusable schema for a user record from the users-api. */
const userRecordSchema = {
  type: 'object',
  description: 'User record from the users-api.',
  properties: {
    uid: { type: 'string', example: 'aB3dE5fG7hI9jK1l' },
    email: { type: 'string', format: 'email', example: 'jane.doe@example.com' },
    role: { type: 'string', example: 'user' },
    enable: { type: 'boolean', example: true },
  },
} as const;

/** Reusable schema for a pre-approved user record. */
const preApprovedUserSchema = {
  type: 'object',
  description: 'Pre-approved user record.',
  properties: {
    email: { type: 'string', format: 'email', example: 'jane.doe@example.com' },
    role: { type: 'string', example: 'admin' },
  },
} as const;

/** Reusable schema for the standard success response metadata. */
const successMeta = {
  type: 'object',
  properties: {
    correlationId: { type: 'string', example: 'req-abc123' },
    timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
  },
} as const;

/** Reusable schema for 400 validation error responses. */
const validationErrorResponse = {
  description: 'Request body or query parameters failed validation.',
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
} as const;

/** Reusable schema for 401 unauthorized responses. */
const unauthorizedResponse = {
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
} as const;

/** Reusable schema for 403 forbidden responses. */
const forbiddenResponse = {
  description: 'Authenticated user does not have permission for this operation.',
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'FORBIDDEN' },
        message: { type: 'string', example: 'Admin access required' },
      },
    },
    meta: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
      },
    },
  },
} as const;

/** Reusable schema for 404 not-found responses. */
const notFoundResponse = {
  description: 'The requested resource was not found.',
  type: 'object',
  properties: {
    success: { type: 'boolean', example: false },
    error: {
      type: 'object',
      properties: {
        code: { type: 'string', example: 'NOT_FOUND' },
        message: { type: 'string', example: 'User not found' },
      },
    },
    meta: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
      },
    },
  },
} as const;

/** Reusable schema for 500 internal server error responses. */
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
    meta: {
      type: 'object',
      properties: {
        timestamp: { type: 'string', format: 'date-time', example: '2026-01-15T10:30:00.000Z' },
      },
    },
  },
} as const;

const usersPlugin: FastifyPluginAsync = async (app) => {
  // ── Admin & User Routes ─────────────────────────────────────────────────────

  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List users',
      description: 'Returns a paginated list of users. Available to all authenticated users.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          maxResults: { type: 'integer', minimum: 1, maximum: 1000, default: 100, example: 50 },
          pageToken: { type: 'string', example: 'eyJhbGciOiJSUzI1NiJ9...' },
        },
      },
      response: {
        200: {
          description: 'Paginated list of users retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                users: { type: 'array', items: userRecordSchema },
                pageToken: { type: 'string', example: 'eyJhbGciOiJSUzI1NiJ9...' },
              },
            },
            meta: successMeta,
          },
        },
        400: validationErrorResponse,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        500: internalErrorResponse,
      },
    },
  }, listUsersHandler);

  // Must be registered BEFORE /:uid to avoid route conflicts
  app.get('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'List or get pre-approved users (admin only)',
      description: 'Lists all pre-approved users, or gets a specific one by email.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          email: { type: 'string', example: 'jane.doe@example.com' },
        },
      },
      response: {
        200: {
          description: 'Pre-approved user(s) retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {},
            meta: successMeta,
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, getPreApprovedHandler);

  app.post('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'Add a pre-approved user (admin only)',
      description: 'Adds an email and role to the pre-approved users list.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: { type: 'string', example: 'jane.doe@example.com' },
          role: { type: 'string', example: 'admin' },
        },
      },
      response: {
        201: {
          description: 'Pre-approved user added successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: preApprovedUserSchema,
            meta: successMeta,
          },
        },
        400: validationErrorResponse,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        500: internalErrorResponse,
      },
    },
  }, addPreApprovedHandler);

  app.delete('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'Delete a pre-approved user (admin only)',
      description: 'Removes a user from the pre-approved list by email.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', example: 'jane.doe@example.com' },
        },
      },
      response: {
        204: { description: 'Pre-approved user removed successfully.', type: 'null' },
        400: validationErrorResponse,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, deletePreApprovedHandler);

  app.patch('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'Update a pre-approved user (admin only)',
      description: 'Updates a pre-approved user\'s role.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['email'],
        properties: {
          email: { type: 'string', example: 'jane.doe@example.com' },
        },
      },
      body: {
        type: 'object',
        properties: {
          role: { type: 'string', example: 'user' },
        },
      },
      response: {
        200: {
          description: 'Pre-approved user updated successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: preApprovedUserSchema,
            meta: successMeta,
          },
        },
        400: validationErrorResponse,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, updatePreApprovedHandler);

  // ── Admin Only Routes ───────────────────────────────────────────────────────

  app.get('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by UID',
      description: 'Retrieves a single user record by UID. Available to all authenticated users.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: {
          uid: { type: 'string', example: 'aB3dE5fG7hI9jK1l' },
        },
      },
      response: {
        200: {
          description: 'User record retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: userRecordSchema,
            meta: successMeta,
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, getUserHandler);

  app.patch('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Update user by UID',
      description:
        'Updates a user. Admins may update any user with any field. ' +
        'Non-admins may only update their own email.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: {
          uid: { type: 'string', example: 'aB3dE5fG7hI9jK1l' },
        },
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', example: 'new.email@example.com' },
          role: { type: 'string', example: 'admin', description: 'Admin only.' },
          enable: { type: 'boolean', example: true, description: 'Admin only.' },
        },
      },
      response: {
        200: {
          description: 'User updated successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: userRecordSchema,
            meta: successMeta,
          },
        },
        400: validationErrorResponse,
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, updateUserHandler);

  app.delete('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user by UID (admin only)',
      description: 'Permanently deletes a user. Requires the admin role.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: {
          uid: { type: 'string', example: 'aB3dE5fG7hI9jK1l' },
        },
      },
      response: {
        204: { description: 'User deleted successfully.', type: 'null' },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, deleteUserHandler);
};

export default usersPlugin;
