/**
 * @module @elastic-resume-base/harbor/client
 *
 * HarborClient **browser-safe** entry point.
 *
 * This module exposes only the basic HTTP client factory and related types.
 * It contains no server-side logic (no IAM authentication, no service-account
 * credentials). Use this module in frontend code or any environment where
 * Node.js-only packages (e.g. `google-auth-library`) are unavailable.
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
import axios from 'axios';
// ─── Factory ──────────────────────────────────────────────────────────────────
/**
 * Creates a pre-configured {@link HarborClient} for communicating with a
 * downstream service.
 *
 * The returned client applies `baseURL` as the root for all relative URLs,
 * enforces the optional `timeoutMs` on every request, and attaches any
 * `defaultHeaders` to every outgoing request.
 *
 * @param options - Configuration for the HTTP client.
 * @returns A configured HarborClient ready for use.
 */
export function createHarborClient(options) {
    return axios.create({
        baseURL: options.baseURL,
        timeout: options.timeoutMs,
        headers: options.defaultHeaders,
    });
}
// ─── Error utilities ──────────────────────────────────────────────────────────
/**
 * Determines whether the given value is an error that originated from a
 * HarborClient request (i.e. an Axios-level error).
 *
 * Use this guard in `catch` blocks to distinguish HarborClient errors
 * (network failures, HTTP error responses, timeouts) from other unexpected
 * errors before mapping them to domain-specific error types.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is a HarborClient (Axios) error.
 */
export const isHarborError = axios.isAxiosError;
//# sourceMappingURL=index.js.map