import type { FastifyPluginAsync } from 'fastify';
import {
  createUserHandler,
  getUserHandler,
  updateUserHandler,
  deleteUserHandler,
  listUsersHandler,
} from '../controllers/users.controller.js';

const usersPlugin: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List users',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          maxResults: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          pageToken: { type: 'string' },
        },
      },
      response: {
        200: { type: 'object' },
        401: { type: 'object' },
      },
    },
  }, listUsersHandler);

  app.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user (admin only)',
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['email', 'password'],
        properties: {
          email: { type: 'string', format: 'email' },
          password: { type: 'string', minLength: 6 },
          displayName: { type: 'string' },
          photoURL: { type: 'string' },
          disabled: { type: 'boolean' },
        },
      },
      response: {
        201: { type: 'object' },
        400: { type: 'object' },
        401: { type: 'object' },
        403: { type: 'object' },
      },
    },
  }, createUserHandler);

  app.get('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by UID',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
      response: {
        200: { type: 'object' },
        401: { type: 'object' },
        404: { type: 'object' },
      },
    },
  }, getUserHandler);

  app.patch('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Update user by UID',
      description:
        'Admins may update any user with all fields. ' +
        'Non-admins may only update their own profile and are restricted to ' +
        'non-sensitive fields (displayName, photoURL).',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string', format: 'email', description: 'Admin only' },
          password: { type: 'string', minLength: 6, description: 'Admin only' },
          displayName: { type: 'string' },
          photoURL: { type: 'string' },
          disabled: { type: 'boolean', description: 'Admin only' },
        },
      },
      response: {
        200: { type: 'object' },
        401: { type: 'object' },
        403: { type: 'object' },
        404: { type: 'object' },
      },
    },
  }, updateUserHandler);

  app.delete('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user by UID (admin only)',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
      response: {
        204: { type: 'null' },
        401: { type: 'object' },
        403: { type: 'object' },
        404: { type: 'object' },
      },
    },
  }, deleteUserHandler);
};

export default usersPlugin;
