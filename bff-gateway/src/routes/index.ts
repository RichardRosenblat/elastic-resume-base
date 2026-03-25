import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';
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
      // Rate limiting runs at the onRequest lifecycle phase (the default for
      // @fastify/rate-limit, which attaches its check as a route-level onRequest
      // hook via Fastify's onRoute mechanism).  The authHook is registered at
      // preHandler — a later lifecycle phase — so every request is throttled
      // before the expensive Firebase token-verification and users-api calls run.
      // This prevents denial-of-service attacks via token flooding.
      await api.register(rateLimit, {
        max: config.apiV1RateLimitMax,
        timeWindow: config.apiV1RateLimitTimeWindow,
      });
      api.addHook('preHandler', authHook);
      await api.register(resumesPlugin, { prefix: '/resumes' });
      await api.register(searchPlugin, { prefix: '/search' });
      await api.register(documentsPlugin, { prefix: '/documents' });
      await api.register(usersPlugin, { prefix: '/users' });
    },
    { prefix: '/api/v1' },
  );
};

export default routes;
