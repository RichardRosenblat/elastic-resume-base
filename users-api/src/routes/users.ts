import type { FastifyPluginAsync } from 'fastify';
import {
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
  getUserRoleHandler,
  getBatchRolesHandler,
} from '../controllers/users.controller.js';

/** Reusable schema for a Firestore user document as returned by the Users API. */
const firestoreUserSchema = {
  type: 'object',
  description: 'Firestore user document.',
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
    role: {
      type: 'string',
      description: "Application-level role assigned to the user (e.g. 'admin', 'user').",
      example: 'user',
    },
    disabled: {
      type: 'boolean',
      description: 'Whether the user account is disabled.',
      example: false,
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
        'Returns a paginated list of Firestore user documents. ' +
        'Use `pageToken` from the previous response to fetch the next page. ' +
        'Called internally by the BFF gateway for admin user-management operations.',
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
            description: 'Pagination cursor returned by the previous list call.',
            example: 'eyJsYXN0VWlkIjoiYUIzZEU1ZkcifQ==',
          },
        },
      },
      response: {
        200: {
          description: 'Paginated list of Firestore user documents.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                users: {
                  type: 'array',
                  description: 'Array of Firestore user documents on this page.',
                  items: firestoreUserSchema,
                },
                pageToken: {
                  type: 'string',
                  description: 'Cursor to pass as `pageToken` to retrieve the next page. Absent on the last page.',
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

  app.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      description:
        'Creates a new Firestore user document. ' +
        'If `uid` is not provided, a new UID is generated. ' +
        'The `email` field is required. ' +
        'The optional `role` field sets the application-level role (defaults to `user` if omitted).',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          uid: {
            type: 'string',
            description: 'Optional Firebase UID to use for the new user document. Generated automatically if omitted.',
            example: 'aB3dE5fG7hI9jK1l',
          },
          email: {
            type: 'string',
            description: "New user's email address.",
            example: 'jane.doe@example.com',
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
          role: {
            type: 'string',
            description: "Application-level role for the user (e.g. 'admin', 'user'). Defaults to 'user'.",
            example: 'user',
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
          description: 'User document created successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: firestoreUserSchema,
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        500: internalErrorResponse,
      },
    },
  }, createUserHandler);

  // Must be registered BEFORE /:uid to avoid route conflicts
  app.post('/roles/batch', {
    schema: {
      tags: ['Users'],
      summary: 'Get roles for multiple users',
      description:
        'Returns a map of `{ uid → role }` for the provided list of UIDs. ' +
        'Used by the BFF gateway to resolve roles in bulk. ' +
        'UIDs not found in Firestore are omitted from the response.',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['uids'],
        properties: {
          uids: {
            type: 'array',
            items: {
              type: 'string',
              description: 'A Firebase UID.',
              example: 'aB3dE5fG7hI9jK1l',
            },
            minItems: 1,
            description: 'List of Firebase UIDs to look up (at least one required).',
            example: ['aB3dE5fG7hI9jK1l', 'mN2oP4qR6sT8uV0w'],
          },
        },
      },
      response: {
        200: {
          description: 'Role map retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              additionalProperties: {
                type: 'string',
                description: "Role assigned to the user (e.g. 'admin', 'user').",
              },
              description: 'Map of uid → role for each found user.',
              example: { aB3dE5fG7hI9jK1l: 'admin', mN2oP4qR6sT8uV0w: 'user' },
            },
            meta: responseMeta,
          },
        },
        400: validationErrorResponse,
        500: internalErrorResponse,
      },
    },
  }, getBatchRolesHandler);

  // Must be registered BEFORE /:uid to prevent email path segments (e.g. /role/user@example.com)
  // from being matched as /:uid with uid="role".
  app.get('/role/:email', {
    schema: {
      tags: ['Users'],
      summary: 'Get the access role for a user by email (BFF access check)',
      description:
        'Implements the BFF Authorization Logic used to determine whether a user ' +
        'may access the application. ' +
        'If `ADMIN_SHEET_FILE_ID` is configured, checks Google Drive file permissions via Bugle; ' +
        'otherwise falls back to reading the `role` field from Firestore. ' +
        'Returns HTTP 200 with the resolved role on success, or HTTP 403 when the user has no access.',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['email'],
        properties: {
          email: {
            type: 'string',
            description: "User's email address.",
            example: 'jane.doe@example.com',
          },
        },
      },
      response: {
        200: {
          description: "User's application role resolved successfully.",
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              properties: {
                role: {
                  type: 'string',
                  description: "Application-level role assigned to the user (e.g. 'admin', 'user').",
                  example: 'user',
                },
              },
            },
            meta: responseMeta,
          },
        },
        403: forbiddenResponse,
        500: internalErrorResponse,
      },
    },
  }, getUserRoleHandler);

  app.get('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by UID',
      description:
        'Retrieves a single Firestore user document by Firebase UID. ' +
        'Returns 404 if no document exists for the given UID.',
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
          description: 'User document retrieved successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: firestoreUserSchema,
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
      summary: 'Update user by UID',
      description:
        'Partially updates a Firestore user document. ' +
        'Only the provided fields are changed; all other fields remain unchanged. ' +
        'Returns 404 if no document exists for the given UID.',
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
            description: "Updated email address.",
            example: 'new.email@example.com',
          },
          displayName: {
            type: 'string',
            description: 'Updated display name.',
            example: 'Jane Smith',
          },
          photoURL: {
            type: 'string',
            description: 'Updated profile photo URL.',
            example: 'https://example.com/new-photo.jpg',
          },
          role: {
            type: 'string',
            description: "Updated application-level role (e.g. 'admin', 'user').",
            example: 'admin',
          },
          disabled: {
            type: 'boolean',
            description: 'Enable or disable the account.',
            example: false,
          },
        },
      },
      response: {
        200: {
          description: 'User document updated successfully.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: firestoreUserSchema,
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
      summary: 'Delete user by UID',
      description:
        'Permanently removes a Firestore user document. ' +
        'Returns 404 if no document exists for the given UID. ' +
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
