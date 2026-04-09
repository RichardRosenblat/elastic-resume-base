/**
 * @file index.ts — Root route plugin for the Gateway API.
 *
 * Registers all sub-plugins in two groups:
 * - **Public** routes (health probes) — no authentication required.
 * - **Protected** routes (`/api/v1/*`) — require a valid Firebase ID token,
 *   are rate-limited via `@fastify/rate-limit`, and enforce RBAC via the
 *   `authHook` / `requireAdminHook` middleware.
 */
import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
import { config } from '../config.js';
import { authHook } from '../middleware/auth.js';
import { buildRateLimitErrorResponseBuilder } from '../utils/rateLimitErrorResponseBuilder.js';
import healthPlugin from './health.js';
import resumesPlugin from './resumes.js';
import searchPlugin from './search.js';
import documentsPlugin from './documents.js';
import usersPlugin from './users.js';
import notificationsPlugin from './notifications.js';

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
        global: true,
        max: config.apiV1RateLimitMax,
        timeWindow: config.apiV1RateLimitTimeWindow,
        errorResponseBuilder: buildRateLimitErrorResponseBuilder('API v1'),
      });
      api.addHook('preHandler', authHook);
      await api.register(resumesPlugin, { prefix: '/resumes' });
      await api.register(searchPlugin, { prefix: '/search' });
      await api.register(documentsPlugin, { prefix: '/documents' });
      await api.register(usersPlugin, { prefix: '/users' });
      await api.register(notificationsPlugin, { prefix: '/notifications' });
    },
    { prefix: '/api/v1' },
  );
};

export default routes;
