import Fastify from 'fastify';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import rateLimit from '@fastify/rate-limit';
import type { FastifyInstance } from 'fastify';
import { formatError } from '@elastic-resume-base/bowltie';
import { config } from './config.js';
import { setupSwagger } from './swagger.js';
import { correlationIdHook } from './middleware/correlationId.js';
import { requestLoggerHook } from './middleware/requestLogger.js';
import { errorHandler } from './middleware/errorHandler.js';
import { ValidationError } from './errors.js';
import { logger } from './utils/logger.js';
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
        strict: false, // allow OpenAPI annotation keywords (e.g. 'example') in schemas
        coerceTypes: true,
        useDefaults: true,
      },
    },
    schemaErrorFormatter: (errors, dataVar) => {
      const messages = errors
        .map(err => {
          const path = err.instancePath.replace(/^\//, '').replace(/\//g, '.');
          const msg = err.message ?? 'invalid value';
          return path ? `${path}: ${msg}` : msg;
        })
        .filter(Boolean);
      return new ValidationError(messages.join('; ') || `${dataVar} validation failed`);
    },
  });

  // Swagger must be registered before routes so schemas are collected
  await setupSwagger(app);

  // Security / cross-cutting plugins
  await app.register(helmet);
  await app.register(cors, { origin: config.allowedOrigins.split(',') });
  await app.register(rateLimit, {
    max: config.rateLimitMax,
    timeWindow: config.rateLimitTimeWindow,
    errorResponseBuilder: (req, context) => {
      const retryAfterSec = Math.ceil(context.ttl / 1000);
      const message = `Too many requests. Please wait ${retryAfterSec} second${retryAfterSec !== 1 ? 's' : ''} and try again.`;
      const correlationId = req.correlationId ?? req.id;
      logger.warn({ correlationId, ip: req.ip, limit: context.max }, 'Global rate limit exceeded');
      return formatError('RATE_LIMIT_EXCEEDED', message, correlationId);
    },
  });

  // Global request hooks
  app.addHook('onRequest', correlationIdHook);
  app.addHook('onResponse', requestLoggerHook);

  // Global error handler (must be set before routes)
  app.setErrorHandler(errorHandler);

  // Route registration
  await app.register(routes);

  // Backward-compatible JSON spec endpoint
  app.get('/api/v1/docs.json', (_request, reply) => {
    void reply.send(app.swagger());
  });

  return app;
}

export default buildApp;
