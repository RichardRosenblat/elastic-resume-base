import type { FastifyPluginAsync } from 'fastify';
import { getProfile } from '../controllers/me.controller.js';

const mePlugin: FastifyPluginAsync = async (app) => {
  app.get('/', {
    schema: {
      tags: ['Me'],
      summary: 'Get current user profile',
      security: [{ bearerAuth: [] }],
    },
  }, getProfile);
};

export default mePlugin;
