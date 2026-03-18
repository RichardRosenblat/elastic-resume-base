import type { FastifyPluginAsync } from 'fastify';
import { getLive, getReady } from '../controllers/health.controller.js';

const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string', example: 'ok' } },
        },
      },
    },
  }, getLive);

  app.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      response: {
        200: {
          type: 'object',
          properties: { status: { type: 'string', example: 'ok' } },
        },
      },
    },
  }, getReady);
};

export default healthPlugin;
