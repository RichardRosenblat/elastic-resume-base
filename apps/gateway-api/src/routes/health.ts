import type { FastifyPluginAsync } from 'fastify';
import { getLive, getReady, getDownstream } from '../controllers/health.controller.js';

const healthPlugin: FastifyPluginAsync = async (app) => {
  app.get('/live', {
    schema: {
      tags: ['Health'],
      summary: 'Liveness probe',
      description:
        'Returns HTTP 200 when the Gateway process is running. ' +
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
        'Returns HTTP 200 when the Gateway is ready to accept traffic. ' +
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

  app.get('/downstream', {
    schema: {
      tags: ['Health'],
      summary: 'Downstream services status',
      description:
        'Checks the health of all downstream services and returns their status. ' +
        'Always returns HTTP 200; individual service availability is reflected in the response body.',
      response: {
        200: {
          description: 'Downstream service statuses.',
          type: 'object',
          properties: {
            downstream: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  status: {
                    type: 'string',
                    enum: ['ok', 'degraded'],
                    description: '"ok" if reachable, "degraded" if not.',
                  },
                },
              },
            },
          },
        },
      },
    },
  }, getDownstream);
};

export default healthPlugin;
