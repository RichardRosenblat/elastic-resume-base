import { ValidationError } from './errors.js';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import Fastify from 'fastify';
import { config } from './config.js';
import { correlationIdHook } from './middleware/correlationId.js';
import { errorHandler } from './middleware/errorHandler.js';
import { requestLoggerHook } from './middleware/requestLogger.js';
import routes from './routes/index.js';
import { bootstrapAdminUser } from './services/usersService.js';
import { setupSwagger } from './swagger.js';

/**
 * Builds and configures the Fastify application instance.
 * Call `app.listen()` separately to start the server.
 * @returns Configured Fastify instance (not yet listening).
 */
export async function buildApp(): Promise<FastifyInstance> {
  const app = Fastify({
    trustProxy: true,
    bodyLimit: 10 * 1024 * 1024, // 10 MB
    ajv: {
      customOptions: {
        strict: false, // allow OpenAPI annotation keywords (e.g. 'example') in schemas
        coerceTypes: true,
        useDefaults: true,
      },
    },
    schemaErrorFormatter: (_errors, dataVar) => new ValidationError(`${dataVar} validation failed`),
  });

  // Swagger must be registered before routes so schemas are collected
  await setupSwagger(app);

  // Security / cross-cutting plugins
  await app.register(helmet);
  await app.register(cors, { origin: config.allowedOrigins.split(',') });
  await app.register(rateLimit, { max: 100, timeWindow: '15 minutes' });

  // Global request hooks
  app.addHook('onRequest', correlationIdHook);
  app.addHook('onResponse', requestLoggerHook);

  // Global error handler (must be set before routes)
  app.setErrorHandler(errorHandler);

  // Route registration
  await app.register(routes);

  // admin-user bootstrap
  app.addHook('onReady', async () => {
    await bootstrapAdminUser();
  });

  return app;
}

export default buildApp;
