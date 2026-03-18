import { v4 as uuidv4 } from 'uuid';

/**
 * Minimal request interface needed by the correlation ID hook.
 * Structurally compatible with `FastifyRequest`.
 * Using minimal interfaces avoids a hard dependency on the `fastify` package,
 * which prevents version-mismatch errors when Toolbox is used alongside a
 * service that already has its own `fastify` installation.
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
 * import { correlationIdHook } from '@elastic-resume-base/toolbox';
 *
 * app.addHook('onRequest', correlationIdHook);
 * ```
 */
export function correlationIdHook(
  request: CorrelationRequest,
  reply: CorrelationReply,
  done: () => void,
): void {
  const correlationId = (request.headers['x-correlation-id'] as string) || uuidv4();
  request.correlationId = correlationId;
  void reply.header('x-correlation-id', correlationId);
  done();
}
