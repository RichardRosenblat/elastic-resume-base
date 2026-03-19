import type { FastifyPluginAsync } from 'fastify';
import { getProfile } from '../controllers/me.controller.js';

const mePlugin: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      tags: ['Me'],
      summary: 'Get current user profile',
      description:
        'Returns the Firebase-decoded identity of the currently authenticated user. ' +
        'Requires a valid Firebase ID token in the Authorization header.',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          description: 'Authenticated user profile.',
          type: 'object',
          properties: {
            success: { type: 'boolean', example: true },
            data: {
              type: 'object',
              description: 'Decoded Firebase identity fields.',
              properties: {
                uid: {
                  type: 'string',
                  description: 'Firebase UID of the authenticated user.',
                  example: 'aB3dE5fG7hI9jK1l',
                },
                email: {
                  type: 'string',
                  format: 'email',
                  description: 'Email address from the Firebase token.',
                  example: 'jane.doe@example.com',
                },
                name: {
                  type: 'string',
                  description: 'Display name from the Firebase token, if present.',
                  example: 'Jane Doe',
                },
                picture: {
                  type: 'string',
                  format: 'uri',
                  description: 'Profile picture URL from the Firebase token, if present.',
                  example: 'https://example.com/photo.jpg',
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
      },
    },
  }, getProfile);
};

export default mePlugin;
