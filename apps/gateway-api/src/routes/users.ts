import type { FastifyPluginAsync, RouteHandlerMethod } from 'fastify';
import { requireAdminHook } from '../middleware/auth.js';
import {
  getMeHandler,
  listUsersHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  batchUpdateUsersHandler,
  batchDeleteUsersHandler,
  getPreApprovedHandler,
  addPreApprovedHandler,
  deletePreApprovedHandler,
  updatePreApprovedHandler,
  batchDeletePreApprovedHandler,
  batchUpdatePreApprovedHandler,
} from '../controllers/users.controller.js';
import { usersProxyHandler } from '../controllers/usersProxy.controller.js';

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
  // ── Self-service Routes (authenticated user's own profile) ──────────────────

  // Must be registered BEFORE /:uid to avoid route conflicts
  app.get('/me', {
    schema: {
      tags: ['Users'],
      summary: 'Get authenticated user profile',
      description: 'Returns the authenticated user\'s profile from the users store.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Authenticated user profile retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: userRecordSchema,
            meta: successMeta,
          },
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        500: internalErrorResponse,
      },
    },
  }, getMeHandler);

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
          email: { type: 'string', format: 'email', description: 'Filter by exact email address.', example: 'jane.doe@example.com' },
          role: { type: 'string', enum: ['admin', 'user'], example: 'admin', description: "Filter by role ('admin' or 'user')." },
          enable: { type: 'string', enum: ['true', 'false'], description: 'Filter by enabled status.' },
          orderBy: { type: 'string', enum: ['uid', 'email', 'role', 'enable'], description: 'Sort users by field.', example: 'email' },
          orderDirection: { type: 'string', enum: ['asc', 'desc'], description: 'Sort direction.', example: 'asc' },
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
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Pre-Approved Users'],
      summary: 'List or get pre-approved users (admin only)',
      description: 'Lists all pre-approved users, or gets a specific one by email.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          email: { type: 'string', example: 'jane.doe@example.com' },
          role: { type: 'string', enum: ['admin', 'user'], example: 'admin', description: 'Filter list by role.' },
          orderBy: { type: 'string', enum: ['email', 'role'], example: 'email', description: 'Sort pre-approved users by field.' },
          orderDirection: { type: 'string', enum: ['asc', 'desc'], example: 'asc', description: 'Sort direction.' },
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
  }, getPreApprovedHandler as RouteHandlerMethod);

  app.post('/pre-approve', {
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Pre-Approved Users'],
      summary: 'Add a pre-approved user (admin only)',
      description: 'Adds an email and role to the pre-approved users list.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: { type: 'string', example: 'jane.doe@example.com' },
          role: { type: 'string', enum: ['admin', 'user'], example: 'admin', description: "Must be 'admin' or 'user'." },
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
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Pre-Approved Users'],
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
  }, deletePreApprovedHandler as RouteHandlerMethod);

  app.patch('/pre-approve', {
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Pre-Approved Users'],
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
          role: { type: 'string', enum: ['admin', 'user'], example: 'user', description: "Must be 'admin' or 'user'." },
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
  }, updatePreApprovedHandler as RouteHandlerMethod);

  app.delete('/pre-approve/batch', {
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Pre-Approved Users'],
      summary: 'Batch delete pre-approved users (admin only)',
      description: 'Removes multiple users from the pre-approved list by email. Entries not found are silently skipped.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['emails'],
        properties: {
          emails: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            example: ['alice@example.com', 'bob@example.com'],
          },
        },
      },
      response: {
        200: {
          description: 'Batch delete completed successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                deleted: { type: 'integer', example: 2 },
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
  }, batchDeletePreApprovedHandler as RouteHandlerMethod);

  app.patch('/pre-approve/batch', {
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Pre-Approved Users'],
      summary: 'Batch update pre-approved users (admin only)',
      description: 'Applies the same role update to multiple pre-approved users. Entries not found are silently skipped.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['emails', 'role'],
        properties: {
          emails: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            example: ['alice@example.com', 'bob@example.com'],
          },
          role: { type: 'string', enum: ['admin', 'user'], example: 'user', description: "Must be 'admin' or 'user'." },
        },
      },
      response: {
        200: {
          description: 'Batch update completed successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                updated: { type: 'integer', example: 3 },
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
  }, batchUpdatePreApprovedHandler as RouteHandlerMethod);

  // ── Batch Routes (must be before /:uid to avoid route conflicts) ────────────

  app.patch('/batch', {
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Users'],
      summary: 'Batch update users (admin only)',
      description:
        'Applies the same role and/or enable update to multiple users at once. ' +
        'Users not found are silently skipped. Rejects the entire request if it would remove all active admins.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['uids'],
        properties: {
          uids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            example: ['aB3dE5fG7hI9jK1l', 'mN5oP7qR9sT1uV3w'],
          },
          role: { type: 'string', enum: ['admin', 'user'], example: 'user', description: "Must be 'admin' or 'user'." },
          enable: { type: 'boolean', example: true },
        },
      },
      response: {
        200: {
          description: 'Batch update completed successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                updated: { type: 'integer', example: 3 },
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
  }, batchUpdateUsersHandler as RouteHandlerMethod);

  app.delete('/batch', {
    preHandler: [requireAdminHook],
    schema: {
      tags: ['Users'],
      summary: 'Batch delete users (admin only)',
      description:
        'Permanently removes multiple users at once. ' +
        'Users not found are silently skipped. Rejects the entire request if it would delete all active admins.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['uids'],
        properties: {
          uids: {
            type: 'array',
            items: { type: 'string' },
            minItems: 1,
            example: ['aB3dE5fG7hI9jK1l', 'mN5oP7qR9sT1uV3w'],
          },
        },
      },
      response: {
        200: {
          description: 'Batch delete completed successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                deleted: { type: 'integer', example: 2 },
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
  }, batchDeleteUsersHandler as RouteHandlerMethod);

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
        'Updates a user (admin only). Admins may update role or enable status.',
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
          email: { type: 'string', format: 'email', example: 'jane.doe@example.com', description: 'New email address for the user.' },
          role: { type: 'string', enum: ['admin', 'user'], example: 'admin', description: "Must be 'admin' or 'user'." },
          enable: { type: 'boolean', example: true },
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
  }, updateUserHandler as RouteHandlerMethod);

  app.delete('/:uid', {
    preHandler: [requireAdminHook],
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
  }, deleteUserHandler as RouteHandlerMethod);

  // ── Transparent Proxy (catch-all) ──────────────────────────────────────────
  // This wildcard route forwards any request that does not match an explicit
  // route above to the Users API unchanged.  It enables the BFF to remain
  // compatible with new Users API endpoints without requiring new BFF routes.
  // Auth is enforced by the parent scope's `authHook` preHandler hook.
  app.all('/*', usersProxyHandler as RouteHandlerMethod);
};

export default usersPlugin;
