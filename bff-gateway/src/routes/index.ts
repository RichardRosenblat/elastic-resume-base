import type { FastifyPluginAsync } from 'fastify';
import rateLimit from '@fastify/rate-limit';
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
      await api.register(rateLimit, { max: 100, timeWindow: '15 minutes' });
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
