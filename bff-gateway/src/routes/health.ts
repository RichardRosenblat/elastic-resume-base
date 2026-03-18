import type { FastifyPluginAsync } from 'fastify';
import { getLive, getReady } from '../controllers/health.controller.js';

const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
    },
  }, getLive);

  app.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
    },
  }, getReady);
};

export default healthPlugin;
