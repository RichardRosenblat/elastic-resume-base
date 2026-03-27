import { randomUUID } from 'node:crypto';

/**
 * Fastify `onRequest` hook that attaches a correlation ID to every incoming request
 * for distributed tracing.
 *
 * Resolution order:
 * 1. The value of the incoming `x-correlation-id` header (forwarded from an
 *    upstream service or client).
 * 2. A freshly generated UUID v4 (when no header is present).
 *
 * The resolved ID is stored on `request.correlationId` and echoed back to the
 * caller via the `x-correlation-id` response header.
 *
 * @example
 * ```typescript
 * import { correlationIdHook } from '../../../shared/Toolbox/src/middleware/correlationId.js';
 *
 * app.addHook('onRequest', correlationIdHook);
 * ```
 */

/**
 * Minimal request interface needed by the correlation ID hook.
 * Structurally compatible with `FastifyRequest`.
 */
interface CorrelationRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  correlationId: string;
}

/**
 * Minimal reply interface needed by the correlation ID hook.
 * Structurally compatible with `FastifyReply`.
 */
interface CorrelationReply {
  header(key: string, value: string): unknown;
}

export function correlationIdHook(
  request: CorrelationRequest,
  reply: CorrelationReply,
  done: () => void,
): void {
  const correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();
  request.correlationId = correlationId;
  void reply.header('x-correlation-id', correlationId);
  done();
}

