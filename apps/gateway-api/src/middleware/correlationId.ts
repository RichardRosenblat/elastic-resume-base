import { createCorrelationIdHook } from '@shared/toolbox';
import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';
import { tracingStorage } from '../utils/tracingContext.js';

const _baseHook = createCorrelationIdHook(logger);

/**
 * Fastify `onRequest` hook that:
 * 1. Attaches or generates a correlation ID and GCP Cloud Trace context on
 *    the request (via the shared Toolbox hook).
 * 2. Logs a warning when either tracing header is absent in the incoming request.
 * 3. Stores the resolved tracing context in {@link tracingStorage} so that
 *    all downstream HTTP clients can propagate the headers automatically
 *    without explicit parameter threading.
 */
export function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
  done: () => void,
): void {
  _baseHook(request, reply, () => {
    tracingStorage.run(
      {
        correlationId: request.correlationId,
        traceId: request.traceId,
        spanId: request.spanId,
      },
      done,
    );
  });
}
