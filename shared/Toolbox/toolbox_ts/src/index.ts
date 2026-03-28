/**
 * @shared/toolbox
 *
 * Shared cross-cutting utility definitions for Elastic Resume Base microservices.
 * Consumed via the `@shared/toolbox` tsconfig path alias — this is intentionally
 * NOT a standalone npm package.  All definitions live here so that services only
 * need a single path alias, and tsx can load the file directly.
 *
 * ## Exports
 *
 * - **`correlationIdHook`** — Fastify `onRequest` hook that attaches or
 *   generates a `x-correlation-id` for distributed tracing.
 *
 * - **`createRequestLoggerHook`** — Factory returning a Fastify `onResponse`
 *   hook that logs structured HTTP request/response details.
 *
 * - **Error classes** — `AppError`, `NotFoundError`, `UnauthorizedError`,
 *   `ValidationError`, `ConflictError`, `ForbiddenError`, `DownstreamError`,
 *   `UnavailableError`, `RateLimitError`, `isAppError` — canonical HTTP-mapped
 *   application errors shared across all microservices.
 *
 * - **API types** — Centralized request and response type definitions for all
 *   toolbox APIs (users, downloader, search, file generator, document reader).
 */

import { randomUUID } from 'node:crypto';

// ─── Correlation ID hook ──────────────────────────────────────────────────────

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

/**
 * Fastify `onRequest` hook that attaches a correlation ID and GCP Cloud Trace
 * context to every incoming request for distributed tracing.
 *
 * Correlation ID resolution order:
 * 1. The value of the incoming `x-correlation-id` header.
 * 2. A freshly generated UUID v4 when no header is present.
 *
 * Cloud Trace context resolution order:
 * 1. Parsed from the incoming `x-cloud-trace-context` header when present and
 *    valid (`TRACE_ID/SPAN_ID;o=FLAG` format).
 * 2. Derived from the correlation ID: traceId = UUID without hyphens (32 hex
 *    chars), spanId = `"0"`.
 *
 * The resolved values are stored on the request object and echoed back via
 * `x-correlation-id` and `x-cloud-trace-context` response headers.
 */
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

// ─── Request logger hook ──────────────────────────────────────────────────────

/**
 * Minimal logger interface required by the request logger hook.
 * Structurally compatible with `pino.Logger`.
 */
interface MinimalLogger {
  info(data: Record<string, unknown>, msg: string): void;
}

/**
 * Minimal request interface needed by the request logger hook.
 * Structurally compatible with `FastifyRequest`.
 */
interface LoggableRequest {
  readonly method: string;
  readonly url: string;
  readonly correlationId: string;
  readonly traceId: string;
  readonly spanId: string;
}

/**
 * Minimal reply interface needed by the request logger hook.
 * Structurally compatible with `FastifyReply`.
 */
interface LoggableReply {
  readonly statusCode: number;
  readonly elapsedTime: number;
}

/**
 * Factory that creates a Fastify `onResponse` hook for structured HTTP request
 * logging.  Each entry includes method, path, statusCode, durationMs, and
 * correlationId.
 *
 * @param logger - A Pino logger (or any object with an `info` method).
 */
export function createRequestLoggerHook(
  logger: MinimalLogger,
): (request: LoggableRequest, reply: LoggableReply, done: () => void) => void {
  return function requestLoggerHook(
    request: LoggableRequest,
    reply: LoggableReply,
    done: () => void,
  ): void {
    logger.info(
      {
        method: request.method,
        path: request.url,
        statusCode: reply.statusCode,
        durationMs: Math.round(reply.elapsedTime),
        correlationId: request.correlationId,
        traceId: request.traceId,
        spanId: request.spanId,
      },
      'HTTP request',
    );
    done();
  };
}

// ─── Error classes ────────────────────────────────────────────────────────────

/** Base class for application errors with HTTP status code and machine-readable error code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;

  constructor(message: string, statusCode: number, code: string) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    this.code = code;
  }
}

/** Error representing a resource that could not be found (HTTP 404). */
export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(message, 404, 'NOT_FOUND');
  }
}

/** Error representing a missing or invalid authentication credential (HTTP 401). */
export class UnauthorizedError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'UNAUTHORIZED');
  }
}

/** Error representing invalid input data (HTTP 400). */
export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'VALIDATION_ERROR');
  }
}

/** Error representing a conflict with existing data (HTTP 409). */
export class ConflictError extends AppError {
  constructor(message = 'Resource already exists') {
    super(message, 409, 'CONFLICT');
  }
}

/** Error representing an action that is not permitted for the authenticated user (HTTP 403). */
export class ForbiddenError extends AppError {
  constructor(message = 'Access forbidden') {
    super(message, 403, 'FORBIDDEN');
  }
}

/**
 * Error representing a downstream service that returned a response in an invalid or
 * unexpected format (HTTP 502). Use this only when the downstream did respond but the
 * response could not be parsed or did not match the expected schema.
 *
 * For connectivity/availability issues use {@link UnavailableError} instead.
 */
export class DownstreamError extends AppError {
  constructor(
    message = 'Invalid response from downstream service',
    statusCode = 502,
    code = 'DOWNSTREAM_ERROR',
  ) {
    super(message, statusCode, code);
  }
}

/**
 * Error representing a downstream service that is currently unavailable (HTTP 503).
 * Use for network failures, timeouts, or upstream 5xx responses.
 */
export class UnavailableError extends AppError {
  constructor(message = 'Service unavailable') {
    super(message, 503, 'SERVICE_UNAVAILABLE');
  }
}

/**
 * Error representing a rate limit imposed by a downstream service or by this
 * gateway itself (HTTP 429).
 */
export class RateLimitError extends AppError {
  constructor(message = 'Too many requests. Please wait a moment and try again.') {
    super(message, 429, 'RATE_LIMIT_EXCEEDED');
  }
}

/**
 * Checks whether the given value is an {@link AppError}.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is an `AppError` instance.
 */
export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

// ─── Centralized API types ────────────────────────────────────────────────────

export type {
  UserRecord,
  PreApprovedUser,
  AuthorizeRequest,
  AuthorizeResponse,
  CreateUserRequest,
  UpdateUserRequest,
  AddPreApprovedRequest,
  UpdatePreApprovedRequest,
  ListUsersResponse,
  SortDirection,
  UserSortField,
  PreApprovedSortField,
  UserFilters,
  PreApprovedFilters,
  IngestRequest,
  IngestResponse,
  SearchRequest,
  SearchResult,
  SearchResponse,
  ResumeFormat,
  GenerateRequest,
  GenerateResponse,
  DocumentReadRequest,
  DocumentReadResponse,
} from './api-types.js';

