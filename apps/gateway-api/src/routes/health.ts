/**
 * @file health.ts — Health probe routes for the Gateway API.
 *
 * Exposes three public (unauthenticated) endpoints used by Cloud Run and
 * infrastructure tooling to assess service liveness, readiness, and the
 * health of registered downstream services.
 */
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
        'Returns the service registry snapshot for all downstream services. ' +
        'Always returns HTTP 200; individual service availability is reflected in the response body. ' +
        'For services never yet contacted, a one-time probe is triggered before the response is sent.',
      response: {
        200: {
          description: 'Downstream service registry snapshot.',
          type: 'object',
          properties: {
            downstream: {
              type: 'object',
              additionalProperties: {
                type: 'object',
                properties: {
                  live: {
                    type: 'boolean',
                    description:
                      '`true` if the service process is currently reachable; ' +
                      '`false` if the last contact attempt was a connection-level failure.',
                  },
                  temperature: {
                    type: 'string',
                    enum: ['warm', 'cold'],
                    description:
                      '`warm` if the service was seen alive within the configured TTL ' +
                      '(platform expects instant reply); `cold` otherwise.',
                  },
                  lastSeenAlive: {
                    type: ['string', 'null'],
                    description:
                      'ISO 8601 timestamp of the last successful contact, ' +
                      'or `null` if the service has never been seen alive.',
                  },
                  lastChecked: {
                    type: 'string',
                    description:
                      'ISO 8601 timestamp of the most recent health check attempt ' +
                      '(success or failure).',
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
