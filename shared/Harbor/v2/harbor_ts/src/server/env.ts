/**
 * Environment-aware HTTP client factory for server-side use.
 *
 * Selects the underlying transport based on the `NODE_ENV` environment
 * variable so that callers never need to branch on the environment themselves:
 *
 * - **development** (default when `NODE_ENV` is absent or not `"production"`):
 *   Uses a plain axios client ({@link createHarborClient}).
 * - **production** (`NODE_ENV === "production"`): Uses an IAM-authenticated
 *   axios client ({@link createIamHarborClient}) that automatically attaches a
 *   Google Cloud OIDC identity token to every outgoing request.
 *
 * This file is **server-only** — never import it in browser/frontend code.
 */

import { createHarborClient } from '../client/index.js';
import type { HarborClient, HarborClientOptions } from '../client/index.js';
import { createIamHarborClient } from './iam.js';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Configuration options for {@link createServerHarborClient}.
 *
 * Extends {@link HarborClientOptions} with an optional `audience` field that
 * is only used in production (for Google Cloud IAM authentication).  When
 * `audience` is omitted in production the `baseURL` is used as the audience.
 */
export interface ServerHarborClientOptions extends HarborClientOptions {
  /**
   * IAM OIDC audience used in production mode.
   *
   * For Cloud Run services this is typically the service's HTTPS URL, e.g.
   * `https://my-service-hash-uc.a.run.app`.
   *
   * When omitted, the `baseURL` is used as the audience.  This field has no
   * effect in development mode.
   */
  audience?: string;
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a pre-configured {@link HarborClient} whose transport is chosen
 * automatically based on `NODE_ENV`:
 *
 * - In **development** (default): plain axios — no authentication overhead.
 * - In **production**: IAM-authenticated axios — attaches a Google Cloud OIDC
 *   identity token to every request, enabling secure service-to-service calls
 *   on Google Cloud Run.
 *
 * Callers use the returned client identically in both environments:
 * ```typescript
 * const client = createServerHarborClient({
 *   baseURL: config.usersApiServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 * });
 *
 * const response = await client.get('/api/v1/users');
 * ```
 *
 * @param options - Client configuration.  Set `audience` to override the IAM
 *   OIDC audience used in production (defaults to `baseURL`).
 * @returns A configured HarborClient ready for use.
 *
 * @deprecated The procedural factory interface (`createServerHarborClient`) is deprecated.
 * Use the object-oriented `ServerHarborClient` class from
 * `@elastic-resume-base/harbor` v3 instead:
 * ```typescript
 * import { ServerHarborClient } from '@elastic-resume-base/harbor/server'; // v3
 * const client = new ServerHarborClient({ baseURL: '...', timeoutMs: 30_000 });
 * ```
 * This v2 export will be removed in a future major version.
 */
export function createServerHarborClient(options: ServerHarborClientOptions): HarborClient {
  if (process.env.NODE_ENV === 'production') {
    return createIamHarborClient({
      ...options,
      audience: options.audience ?? options.baseURL,
    });
  }

  return createHarborClient(options);
}
