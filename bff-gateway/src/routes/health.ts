import type { FastifyPluginAsync } from 'fastify';
import { getLive, getReady } from '../controllers/health.controller.js';

const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description:
        'Returns HTTP 200 when the BFF Gateway process is running. ' +
        'Used by orchestrators (Kubernetes, Cloud Run) to decide whether to restart the container.',
      response: {
        200: {
          description: 'Service is alive.',
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Always "ok" when the service is live.',
              example: 'ok',
            },
          },
        },
      },
    },
  }, getLive);

  app.get('/ready', {
    schema: {
      tags: ['Health'],
      summary: 'Readiness probe',
      description:
        'Returns HTTP 200 when the BFF Gateway is ready to accept traffic. ' +
        'Used by orchestrators to gate traffic until the service has fully initialised.',
      response: {
        200: {
          description: 'Service is ready to receive traffic.',
          type: 'object',
          properties: {
            status: {
              type: 'string',
              description: 'Always "ok" when the service is ready.',
              example: 'ok',
            },
          },
        },
      },
    },
  }, getReady);
};

export default healthPlugin;
