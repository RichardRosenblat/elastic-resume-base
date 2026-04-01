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
 */
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, HarborError, } from './shared.js';
export type { HarborClientOptions, HarborClient } from './shared.js';
export { createHarborClient, isHarborError } from './shared.js';
export type { IamHarborClientOptions } from './iam.js';
export { createIamHarborClient } from './iam.js';
//# sourceMappingURL=server.d.ts.map