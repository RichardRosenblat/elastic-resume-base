import { createHarborClient, type HarborClient } from '@elastic-resume-base/harbor';
import { config } from '../config.js';

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
 * @param baseURL - The base URL of the downstream service.
 * @returns Configured HarborClient instance.
 */
export function createHttpClient(baseURL: string): HarborClient {
  return createHarborClient({
    baseURL,
    timeoutMs: config.requestTimeoutMs,
  });
}
