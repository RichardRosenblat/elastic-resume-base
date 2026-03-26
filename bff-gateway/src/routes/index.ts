import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { formatError } from '@elastic-resume-base/bowltie';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { authHook } from '../middleware/auth.js';
import healthPlugin from './health.js';
import resumesPlugin from './resumes.js';
import searchPlugin from './search.js';
import documentsPlugin from './documents.js';
import usersPlugin from './users.js';

const routes: FastifyPluginAsync = async (app) => {
  // Public health routes
  await app.register(healthPlugin, { prefix: '/health' });

  // Protected API v1 routes (require Firebase auth + rate limiting)
  await app.register(
    async (api) => {
      await api.register(rateLimit, {
        max: config.apiV1RateLimitMax,
        timeWindow: config.apiV1RateLimitTimeWindow,
        errorResponseBuilder: (req, context) => {
          const retryAfterSec = Math.ceil(context.ttl / 1000);
          const message = `Too many requests. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? 's' : ''} and try again.`;
          const correlationId: string = req.correlationId ?? req.id;
          logger.warn({ correlationId, ip: req.ip, limit: context.max }, 'API v1 rate limit exceeded');
          return formatError('RATE_LIMIT_EXCEEDED', message, correlationId);
        },
      });
      api.addHook('onRequest', authHook);
      await api.register(resumesPlugin, { prefix: '/resumes' });
      await api.register(searchPlugin, { prefix: '/search' });
      await api.register(documentsPlugin, { prefix: '/documents' });
      await api.register(usersPlugin, { prefix: '/users' });
    },
    { prefix: '/api/v1' },
  );
};

export default routes;
