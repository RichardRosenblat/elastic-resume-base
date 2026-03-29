import { randomUUID } from 'node:crypto';

/**
 * Fastify `onRequest` hook that attaches a correlation ID and GCP Cloud Trace
 * context to every incoming request for distributed tracing.
 *
 * Correlation ID resolution order:
 * 1. The value of the incoming `x-correlation-id` header (forwarded from an
 *    upstream service or client).
 * 2. A freshly generated UUID v4 (when no header is present).
 *
 * Cloud Trace context resolution order:
 * 1. Parsed from the incoming `x-cloud-trace-context` header when present and
 *    valid (`TRACE_ID/SPAN_ID;o=FLAG` format).
 * 2. Derived from the correlation ID: traceId = UUID without hyphens (32 hex
 *    chars), spanId = `"0"`.
 *
 * The resolved values are stored on the request object and echoed back via
 * `x-correlation-id` and `x-cloud-trace-context` response headers.
 *
 * @example
 * ```typescript
 * import { correlationIdHook } from '../../../shared/Toolbox/src/middleware/correlationId.js';
 *
 * app.addHook('onRequest', correlationIdHook);
 * ```
 */

/**
 * Parsed GCP Cloud Trace context extracted from the `X-Cloud-Trace-Context` header.
 */
interface CloudTraceContext {
  traceId: string;
  spanId: string;
}

/**
 * Minimal request interface needed by the correlation ID hook.
 * Structurally compatible with `FastifyRequest`.
 */
interface CorrelationRequest {
  readonly headers: Readonly<Record<string, string | string[] | undefined>>;
  correlationId: string;
  traceId: string;
  spanId: string;
}

/**
 * Minimal reply interface needed by the correlation ID hook.
 * Structurally compatible with `FastifyReply`.
 */
interface CorrelationReply {
  header(key: string, value: string): unknown;
}

/**
 * Parses the `X-Cloud-Trace-Context` header value.
 * Expected format: `TRACE_ID/SPAN_ID;o=TRACE_FLAG`
 * where TRACE_ID is 32 hex chars and SPAN_ID is a decimal integer.
 * Returns `null` when the header is absent or does not match the expected format.
 */
function parseCloudTraceContext(header: string | undefined): CloudTraceContext | null {
  if (!header) return null;
  const match = /^([0-9a-f]{32})\/([0-9]+)(?:;o=\d+)?$/i.exec(header);
  if (!match) return null;
  return { traceId: match[1]!.toLowerCase(), spanId: match[2]! };
}

export function correlationIdHook(
  request: CorrelationRequest,
  reply: CorrelationReply,
  done: () => void,
): void {
  const correlationId = (request.headers['x-correlation-id'] as string) || randomUUID();
  request.correlationId = correlationId;
  void reply.header('x-correlation-id', correlationId);

  const cloudTraceHeader = request.headers['x-cloud-trace-context'] as string | undefined;
  const parsed = parseCloudTraceContext(cloudTraceHeader);

  if (parsed) {
    request.traceId = parsed.traceId;
    request.spanId = parsed.spanId;
  } else {
    // Derive trace context from the correlation ID so that every log entry
    // can be correlated with GCP Cloud Trace even without an upstream header.
    request.traceId = correlationId.replace(/-/g, '');
    request.spanId = '0';
  }

  void reply.header('x-cloud-trace-context', `${request.traceId}/${request.spanId};o=1`);
  done();
}

