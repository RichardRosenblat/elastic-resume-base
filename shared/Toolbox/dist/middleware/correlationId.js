import { v4 as uuidv4 } from 'uuid';
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
export function correlationIdHook(request, reply, done) {
    const correlationId = request.headers['x-correlation-id'] || uuidv4();
    request.correlationId = correlationId;
    void reply.header('x-correlation-id', correlationId);
    done();
}
//# sourceMappingURL=correlationId.js.map