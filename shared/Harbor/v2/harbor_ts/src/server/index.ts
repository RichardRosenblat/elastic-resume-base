/**
 * @module @elastic-resume-base/harbor/server
 *
 * HarborClient **server-side** entry point for Node.js services.
 *
 * This module exposes the same basic HTTP client factory as `./client`, plus
 * {@link createIamHarborClient} for **service-to-service** calls that require
 * Google Cloud IAM (OIDC identity token) authentication.
 *
 * **Do not import this module in browser/frontend code.** Use
 * `@elastic-resume-base/harbor/client` instead.
 *
 * ## Quick Start — basic HTTP client
 *
 * ```typescript
 * import { createHarborClient, isHarborError } from '@elastic-resume-base/harbor/server';
 *
 * const client = createHarborClient({
 *   baseURL: config.documentReaderServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 * });
 *
 * const result = await client.post<DocumentReadResponse>('/read', payload);
 * ```
 *
 * ## Quick Start — IAM-authenticated service-to-service client
 *
 * ```typescript
 * import { createIamHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * const client = createIamHarborClient({
 *   baseURL: config.usersApiServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 *   audience: config.usersApiServiceUrl,
 * });
 *
 * // Every request now carries an OIDC identity token.
 * const response = await client.get('/api/v1/users');
 * ```
 *
 * ## Quick Start — environment-aware client (recommended for most services)
 *
 * ```typescript
 * import { createServerHarborClient } from '@elastic-resume-base/harbor/server';
 *
 * // Automatically uses axios in development and IAM auth in production.
 * const client = createServerHarborClient({
 *   baseURL: config.usersApiServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 * });
 *
 * const response = await client.get('/api/v1/users');
 * ```
 */

// ─── Re-exports from shared (common to client and server) ────────────────────
export type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  HarborError,
} from '../client/index.js';

export type { HarborClientOptions, HarborClient } from '../client/index.js';
export { createHarborClient, isHarborError } from '../client/index.js';

// ─── Server-only: IAM-authenticated factory ───────────────────────────────────
export type { IamHarborClientOptions } from './iam.js';
export { createIamHarborClient } from './iam.js';

// ─── Server-only: environment-aware factory ───────────────────────────────────
export type { ServerHarborClientOptions } from './env.js';
export { createServerHarborClient } from './env.js';
