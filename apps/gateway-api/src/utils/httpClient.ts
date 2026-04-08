import { ServerHarborClient, isHarborError, type HarborClient } from '@elastic-resume-base/harbor/server';
import type { InternalAxiosRequestConfig } from 'axios';
import { config } from '../config.js';
import { tracingStorage } from './tracingContext.js';
import { observeSuccess, observeFailure } from '../services/serviceRegistry.js';

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
 * When `serviceKey` is provided, a response interceptor is also attached that
 * passively observes every proxied call and updates the service registry:
 *   - Any HTTP response (including 4xx/5xx) → `observeSuccess` (L4 health).
 *   - Connection-level failures (no response) → `observeFailure`.
 *
 * @param baseURL    - The base URL of the downstream service.
 * @param serviceKey - Optional registry key used for passive health observation.
 * @returns Configured HarborClient instance.
 */
export function createHttpClient(baseURL: string, serviceKey?: string): HarborClient {
  const client = new ServerHarborClient({
    baseURL,
    timeoutMs: config.requestTimeoutMs,
  });

  client.axiosInstance.interceptors.request.use((axiosConfig: InternalAxiosRequestConfig) => {
    const ctx = tracingStorage.getStore();
    if (ctx) {
      axiosConfig.headers['x-correlation-id'] = ctx.correlationId;
      axiosConfig.headers['x-cloud-trace-context'] = `${ctx.traceId}/${ctx.spanId};o=1`;
    }
    return axiosConfig;
  });

  if (serviceKey) {
    client.axiosInstance.interceptors.response.use(
      (response: import('axios').AxiosResponse) => {
        observeSuccess(serviceKey);
        return response;
      },
      (error: unknown) => {
        if (isHarborError(error)) {
          if (!error.response) {
            // Connection-level error (ECONNREFUSED, ETIMEDOUT, DNS failure, …)
            observeFailure(serviceKey);
          } else {
            // HTTP error with a response — service is reachable (L4 health only)
            observeSuccess(serviceKey);
          }
        }
        return Promise.reject(error);
      },
    );
  }

  return client;
}
