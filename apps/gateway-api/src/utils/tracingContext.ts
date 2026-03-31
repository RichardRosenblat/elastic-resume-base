import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Tracing context that is propagated through the request lifecycle via
 * {@link AsyncLocalStorage} so that downstream HTTP clients can inject
 * the correlation ID and GCP Cloud Trace headers without requiring each
 * service function to accept them as explicit parameters.
 */
export interface TracingContext {
  correlationId: string;
  traceId: string;
  spanId: string;
}

/**
 * AsyncLocalStorage instance that holds the current request's tracing context.
 *
 * Set by the {@link correlationIdHook} at the start of each request.
 * Read by the Axios request interceptor in {@link createHttpClient} to inject
 * `x-correlation-id` and `x-cloud-trace-context` headers into every outbound
 * HTTP request made during the same request lifecycle.
 */
export const tracingStorage = new AsyncLocalStorage<TracingContext>();
