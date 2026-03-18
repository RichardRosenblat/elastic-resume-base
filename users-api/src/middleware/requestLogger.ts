import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { logger } from '../utils/logger.js';

/**
 * Fastify onResponse hook that logs each HTTP request after the response is sent.
 */
export function requestLoggerHook(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  logger.info(
    {
      method: request.method,
      path: request.url,
      statusCode: reply.statusCode,
      durationMs: Math.round(reply.elapsedTime),
      correlationId: request.correlationId,
    },
    'HTTP request',
  );
  done();
}
