import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { ValidationError } from '@elastic-resume-base/synapse';
import { config } from './config.js';
import { setupSwagger } from './swagger.js';
import { correlationIdHook } from './middleware/correlationId.js';
import { requestLoggerHook } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import routes from './routes/index.js';

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

  return app;
}

export default buildApp;
