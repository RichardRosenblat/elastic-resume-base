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

const usersPlugin: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      tags: ['Users'],
      summary: 'List users',
      querystring: {
        type: 'object',
        properties: {
          maxResults: { type: 'integer', minimum: 1, maximum: 1000, default: 100 },
          pageToken: { type: 'string' },
        },
      },
    },
  }, listUsersHandler);

  app.post('/', {
    schema: {
      tags: ['Users'],
      summary: 'Create a new user',
      body: {
        type: 'object',
        required: ['email'],
        properties: {
          uid: { type: 'string' },
          email: { type: 'string' },
          displayName: { type: 'string' },
          photoURL: { type: 'string' },
          role: { type: 'string' },
          disabled: { type: 'boolean' },
        },
      },
    },
  }, createUserHandler);

  // Must be registered BEFORE /:uid to avoid route conflicts
  app.post('/roles/batch', {
    schema: {
      tags: ['Users'],
      summary: 'Get roles for multiple users',
      body: {
        type: 'object',
        required: ['uids'],
        properties: {
          uids: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  }, getBatchRolesHandler);

  app.get('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Get user by UID',
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
    },
  }, getUserHandler);

  app.patch('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Update user by UID',
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
      body: {
        type: 'object',
        properties: {
          email: { type: 'string' },
          displayName: { type: 'string' },
          photoURL: { type: 'string' },
          role: { type: 'string' },
          disabled: { type: 'boolean' },
        },
      },
    },
  }, updateUserHandler);

  app.delete('/:uid', {
    schema: {
      tags: ['Users'],
      summary: 'Delete user by UID',
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
    },
  }, deleteUserHandler);

  app.get('/:uid/role', {
    schema: {
      tags: ['Users'],
      summary: 'Get the access role for a user (BFF access check)',
      description:
        'Implements the BFF Authorization Logic. If ADMIN_SHEET_FILE_ID is configured, ' +
        'checks Google Drive permissions via Bugle. Otherwise falls back to Firestore. ' +
        'Returns 403 if the user has no access.',
      params: {
        type: 'object',
        required: ['uid'],
        properties: { uid: { type: 'string' } },
      },
    },
  }, getUserRoleHandler);
};

export default usersPlugin;
