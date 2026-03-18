import type { FastifyPluginAsync } from 'fastify';
import healthRouter from './health.js';
import usersRouter from './users.js';

const routes: FastifyPluginAsync = async (app) => {
  await app.register(healthRouter, { prefix: '/health' });
  await app.register(usersRouter, { prefix: '/api/v1/users' });
};

export default routes;
