import { createHarborClient, type HarborClient } from '@elastic-resume-base/harbor';
import type { InternalAxiosRequestConfig } from 'axios';
import { config } from '../config.js';
import { tracingStorage } from './tracingContext.js';

export type { HarborClient };

/**
 * Creates a pre-configured HarborClient for a downstream service, applying the
 * application-level request timeout from config.
 *
 * Content-Type is set automatically per-request when a body is present
 * (POST/PUT/PATCH with a plain-object payload). It is intentionally omitted here
 * to avoid sending `Content-Type: application/json` on body-less requests such as
 * DELETE and GET, which would cause Fastify to attempt JSON-parsing an empty body
 * and return a 400 error.
 *
 * A request interceptor is attached to every client instance so that the
 * `x-correlation-id` and `x-cloud-trace-context` headers are automatically
 * forwarded to the downstream service when a tracing context is available.
 * The context is set by {@link correlationIdHook} via {@link tracingStorage}.
 *
 * @param baseURL - The base URL of the downstream service.
 * @returns Configured HarborClient instance.
 */
export function createHttpClient(baseURL: string): HarborClient {
  const client = createHarborClient({
    baseURL,
    timeoutMs: config.requestTimeoutMs,
  });

  client.interceptors.request.use((axiosConfig: InternalAxiosRequestConfig) => {
    const ctx = tracingStorage.getStore();
    if (ctx) {
      axiosConfig.headers['x-correlation-id'] = ctx.correlationId;
      axiosConfig.headers['x-cloud-trace-context'] = `${ctx.traceId}/${ctx.spanId};o=1`;
    }
    return axiosConfig;
  });

  return client;
}
