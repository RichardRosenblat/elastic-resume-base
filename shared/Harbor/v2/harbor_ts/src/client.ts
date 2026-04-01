/**
 * @module @elastic-resume-base/harbor/client
 *
 * HarborClient **browser-safe** entry point.
 *
 * This module exposes only the basic HTTP client factory. It contains no
 * server-side logic (no IAM authentication, no service-account credentials).
 * Use this module in frontend code or any environment where Node.js-only
 * packages (e.g. `google-auth-library`) are unavailable.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createHarborClient, isHarborError } from '@elastic-resume-base/harbor/client';
 *
 * const client = createHarborClient({
 *   baseURL: 'https://api.example.com',
 *   timeoutMs: 30_000,
 * });
 *
 * try {
 *   const response = await client.get('/data');
 * } catch (err) {
 *   if (isHarborError(err)) {
 *     // Handle HTTP / network errors
 *   }
 * }
 * ```
 */

export type {
  AxiosInstance,
  AxiosRequestConfig,
  AxiosResponse,
  HarborError,
} from './shared.js';

export type { HarborClientOptions, HarborClient } from './shared.js';
export { createHarborClient, isHarborError } from './shared.js';
