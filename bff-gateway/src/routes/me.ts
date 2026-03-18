import type { FastifyPluginAsync } from 'fastify';
import { getProfile } from '../controllers/me.controller.js';

const mePlugin: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      tags: ['Me'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
        401: { type: 'object' },
      },
    },
  }, getProfile);
};

export default mePlugin;
