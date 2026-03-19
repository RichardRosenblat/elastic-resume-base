import type { FastifyPluginAsync } from 'fastify';
import {
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
} from '../controllers/users.controller.js';

/** Reusable schema for a Firebase Auth user record as returned by the BFF gateway. */
const userRecordSchema = {
  type: 'object',
  description: 'Firebase Auth user record enriched with role information.',
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
    displayName: {
      type: 'string',
      description: "User's human-readable display name.",
      example: 'Jane Doe',
    },
    photoURL: {
      type: 'string',
      format: 'uri',
      description: "URL of the user's profile photo.",
      example: 'https://example.com/photo.jpg',
    },
    disabled: {
      type: 'boolean',
      description: 'Whether the account has been disabled in Firebase Auth.',
      example: false,
    },
    emailVerified: {
      type: 'boolean',
      description: "Whether the user's email address has been verified.",
      example: true,
    },
    role: {
      type: 'string',
      description: "Application-level role assigned to the user (e.g. 'admin', 'user').",
      example: 'user',
    },
    createdAt: {
      type: 'string',
      format: 'date-time',
      description: 'ISO-8601 timestamp when the Firebase Auth account was created.',
      example: '2025-06-01T08:00:00.000Z',
    },
    lastLoginAt: {
      type: 'string',
      format: 'date-time',
      description: "ISO-8601 timestamp of the user's most recent sign-in.",
      example: '2026-01-15T10:30:00.000Z',
    },
  },
} as const;

/** Reusable schema for the standard success response envelope. */
const successMeta = {
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
  description: 'The requested user was not found.',
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
  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List users',
      description:
        'Returns a paginated list of Firebase Auth user accounts. ' +
        'Use `pageToken` from the previous response to fetch the next page. ' +
        'Requires authentication; available to all authenticated application users.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          maxResults: {
            type: 'integer',
            minimum: 1,
            maximum: 1000,
            default: 100,
            description: 'Maximum number of users to return per page (1–1000).',
            example: 50,
          },
          pageToken: {
            type: 'string',
            description: 'Pagination token returned by the previous list call.',
            example: 'eyJhbGciOiJSUzI1NiJ9...',
          },
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
                users: {
                  type: 'array',
                  description: 'Array of user records on this page.',
                  items: userRecordSchema,
                },
                pageToken: {
                  type: 'string',
                  description: 'Token to pass as `pageToken` to retrieve the next page. Absent when there are no more pages.',
                  example: 'eyJhbGciOiJSUzI1NiJ9...',
                },
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

  app.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user (admin only)',
      description:
        'Creates a new Firebase Auth user account. ' +
        'Requires the `admin` role. ' +
        'The `email` field must belong to one of the configured allowed domains (if any). ' +
        'The `password` must be at least 6 characters long.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: {
            type: 'string',
            description: "New user's email address. Must be within the configured allowed domains.",
            example: 'jane.doe@example.com',
          },
          password: {
            type: 'string',
            description: 'Initial password for the account (minimum 6 characters).',
            example: 'S3cur3P@ssw0rd',
          },
          displayName: {
            type: 'string',
            description: "Human-readable display name for the new user.",
            example: 'Jane Doe',
          },
          photoURL: {
            type: 'string',
            description: "URL of the new user's profile photo.",
            example: 'https://example.com/photo.jpg',
          },
          disabled: {
            type: 'boolean',
            description: 'Whether to create the account in a disabled state.',
            example: false,
          },
        },
      },
      response: {
        201: {
          description: 'User created successfully.',
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
        500: internalErrorResponse,
      },
    },
  }, createUserHandler);

  app.get('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by UID',
      description:
        'Retrieves a single Firebase Auth user record by UID. ' +
        'Available to all authenticated application users.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: {
          uid: {
            type: 'string',
            description: 'Firebase UID of the user to retrieve.',
            example: 'aB3dE5fG7hI9jK1l',
          },
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
        'Updates a Firebase Auth user account. ' +
        'Admins may update any user with any field. ' +
        'Non-admins may only update their own profile and are restricted to ' +
        'non-sensitive fields (`displayName`, `photoURL`). ' +
        'Attempting to update another user or a restricted field as a non-admin returns 403.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: {
          uid: {
            type: 'string',
            description: 'Firebase UID of the user to update.',
            example: 'aB3dE5fG7hI9jK1l',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'New email address. Admin only.',
            example: 'new.email@example.com',
          },
          password: {
            type: 'string',
            description: 'New password (minimum 6 characters). Admin only.',
            example: 'N3wS3cur3P@ss',
          },
          displayName: {
            type: 'string',
            description: 'New display name. Available to the user for their own account.',
            example: 'Jane Smith',
          },
          photoURL: {
            type: 'string',
            description: 'New profile photo URL. Available to the user for their own account.',
            example: 'https://example.com/new-photo.jpg',
          },
          disabled: {
            type: 'boolean',
            description: 'Enable or disable the account. Admin only.',
            example: false,
          },
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
      description:
        'Permanently deletes a Firebase Auth user account. ' +
        'Requires the `admin` role. ' +
        'This action cannot be undone.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: {
          uid: {
            type: 'string',
            description: 'Firebase UID of the user to delete.',
            example: 'aB3dE5fG7hI9jK1l',
          },
        },
      },
      response: {
        204: {
          description: 'User deleted successfully. No response body.',
          type: 'null',
        },
        401: unauthorizedResponse,
        403: forbiddenResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, deleteUserHandler);
};

export default usersPlugin;
