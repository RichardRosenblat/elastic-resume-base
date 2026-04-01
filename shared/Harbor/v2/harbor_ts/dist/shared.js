/**
 * Shared types and utilities used by both the Harbor client and server modules.
 *
 * This file is **internal** — consumers should import from `./client` or
 * `./server`, never from this file directly.
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
//# sourceMappingURL=shared.js.map