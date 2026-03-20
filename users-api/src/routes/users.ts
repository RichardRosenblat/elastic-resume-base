import type { FastifyPluginAsync } from 'fastify';
import {
  authorizeHandler,
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
  getPreApprovedHandler,
  addPreApprovedHandler,
  deletePreApprovedHandler,
  updatePreApprovedHandler,
} from '../controllers/users.controller.js';

/** Reusable schema for a user record in the `users` Firestore collection. */
const userRecordSchema = {
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
      description: "Application-level role assigned to the user (e.g. 'admin', 'user').",
      example: 'user',
    },
    enable: {
      type: 'boolean',
      description: 'Whether the user account is enabled and allowed to access protected routes.',
      example: true,
    },
  },
} as const;

/** Reusable schema for a pre-approved user record. */
const preApprovedUserSchema = {
  type: 'object',
  description: 'Pre-approved user document from the pre_approved_users Firestore collection.',
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
} as const;

/** Reusable schema for the standard response metadata. */
const responseMeta = {
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

/** Reusable schema for 403 forbidden responses. */
const forbiddenResponse = {
  description: 'User does not have access to this application.',
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
  // ── Unauthenticated Routes ──────────────────────────────────────────────────

  app.post('/authorize', {
    schema: {
      tags: ['Users'],
      summary: 'Authorize a user (BFF login flow)',
      description:
        'Implements the BFF Authorization Logic. ' +
        'Called by the BFF during the login flow to determine if a user is authorized ' +
        'and to obtain their role and enable status. ' +
        'Checks the users collection, pre_approved_users collection, and allowed email domains in that order.',
      body: {
        type: 'object',
        required: ['uid', 'email'],
        properties: {
          uid: {
            type: 'string',
            description: 'Firebase UID from the authentication token.',
            example: 'aB3dE5fG7hI9jK1l',
          },
          email: {
            type: 'string',
            description: "User's email address from the authentication token.",
            example: 'jane.doe@example.com',
          },
        },
      },
      response: {
        200: {
          description: 'User authorization result.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
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
            },
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        403: forbiddenResponse,
        500: internalErrorResponse,
      },
    },
  }, authorizeHandler);

  // ── Admin & User Routes ─────────────────────────────────────────────────────

  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List users',
      description:
        'Returns a paginated list of user documents from the users collection. ' +
        'Called internally by the BFF gateway.',
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
            description: 'Pagination cursor returned by the previous list call.',
            example: 'eyJsYXN0VWlkIjoiYUIzZEU1ZkcifQ==',
          },
        },
      },
      response: {
        200: {
          description: 'Paginated list of user documents.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  description: 'Array of user documents on this page.',
                  items: userRecordSchema,
                },
                pageToken: {
                  type: 'string',
                  description: 'Cursor to pass as pageToken to retrieve the next page.',
                  example: 'eyJsYXN0VWlkIjoiYUIzZEU1ZkcifQ==',
                },
              },
            },
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        500: internalErrorResponse,
      },
    },
  }, listUsersHandler);

  // Must be registered BEFORE /:uid to avoid route conflicts with static segments
  app.get('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'List or get pre-approved users (admin only)',
      description:
        'Returns all pre-approved users, or a specific one if email query param is provided.',
      querystring: {
        type: 'object',
        properties: {
          email: {
            type: 'string',
            description: 'Optional email to retrieve a specific pre-approved user.',
            example: 'jane.doe@example.com',
          },
        },
      },
      response: {
        200: {
          description: 'Pre-approved user(s) retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {},
            meta: responseMeta,
          },
        },
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, getPreApprovedHandler);

  app.post('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'Add a pre-approved user (admin only)',
      description: 'Adds an email and role to the pre_approved_users collection.',
      body: {
        type: 'object',
        required: ['email', 'role'],
        properties: {
          email: {
            type: 'string',
            description: "Email address to pre-approve.",
            example: 'jane.doe@example.com',
          },
          role: {
            type: 'string',
            description: "Role to assign when the user first logs in.",
            example: 'admin',
          },
        },
      },
      response: {
        201: {
          description: 'Pre-approved user added successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: preApprovedUserSchema,
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        500: internalErrorResponse,
      },
    },
  }, addPreApprovedHandler);

  app.delete('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'Delete a pre-approved user (admin only)',
      description: 'Removes a user from the pre_approved_users collection by email.',
      querystring: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the pre-approved user to remove.',
            example: 'jane.doe@example.com',
          },
        },
      },
      response: {
        204: {
          description: 'Pre-approved user removed successfully. No response body.',
          type: 'null',
        },
        400: validationErrorResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, deletePreApprovedHandler);

  app.patch('/pre-approve', {
    schema: {
      tags: ['Users'],
      summary: 'Update a pre-approved user (admin only)',
      description: 'Updates a pre-approved user in the pre_approved_users collection.',
      querystring: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            description: 'Email address of the pre-approved user to update.',
            example: 'jane.doe@example.com',
          },
        },
      },
      body: {
        type: 'object',
        properties: {
          role: {
            type: 'string',
            description: 'Updated role to assign.',
            example: 'user',
          },
        },
      },
      response: {
        200: {
          description: 'Pre-approved user updated successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: preApprovedUserSchema,
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, updatePreApprovedHandler);

  // ── Admin Only Routes ───────────────────────────────────────────────────────

  app.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user (admin only)',
      description: 'Creates a new user document directly in the users Firestore collection.',
      body: {
        type: 'object',
        required: ['uid', 'email'],
        properties: {
          uid: {
            type: 'string',
            description: 'Firebase UID for the new user document.',
            example: 'aB3dE5fG7hI9jK1l',
          },
          email: {
            type: 'string',
            description: "New user's email address.",
            example: 'jane.doe@example.com',
          },
          role: {
            type: 'string',
            description: "Application-level role (defaults to 'user').",
            example: 'user',
          },
          enable: {
            type: 'boolean',
            description: 'Whether the user is enabled (defaults to false).',
            example: false,
          },
        },
      },
      response: {
        201: {
          description: 'User document created successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: userRecordSchema,
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        500: internalErrorResponse,
      },
    },
  }, createUserHandler);

  app.get('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by UID',
      description: 'Retrieves a single user document from the users Firestore collection by UID.',
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
          description: 'User document retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: userRecordSchema,
            meta: responseMeta,
          },
        },
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, getUserHandler);

  app.patch('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Update user by UID (admin only)',
      description: 'Partially updates a user document in the users Firestore collection.',
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
            description: 'Updated email address.',
            example: 'new.email@example.com',
          },
          role: {
            type: 'string',
            description: "Updated role.",
            example: 'admin',
          },
          enable: {
            type: 'boolean',
            description: 'Enable or disable the account.',
            example: true,
          },
        },
      },
      response: {
        200: {
          description: 'User document updated successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: userRecordSchema,
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, updateUserHandler);

  app.delete('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user by UID (admin only)',
      description: 'Permanently removes a user document from the users Firestore collection.',
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
          description: 'User document deleted successfully. No response body.',
          type: 'null',
        },
        404: notFoundResponse,
        500: internalErrorResponse,
      },
    },
  }, deleteUserHandler);
};

export default usersPlugin;
