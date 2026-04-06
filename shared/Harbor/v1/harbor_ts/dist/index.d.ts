/**
 * @module @elastic-resume-base/harbor
 *
 * HarborClient provides a centralized HTTP request abstraction for all
 * Elastic Resume Base microservices. All outbound HTTP requests should be
 * made through HarborClient instances to ensure consistent configuration,
 * error detection, and a stable foundation for future cross-cutting concerns
 * such as correlation ID forwarding, structured logging, and retries.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { createHarborClient } from '@elastic-resume-base/harbor';
 *
 * const client = createHarborClient({
 *   baseURL: 'http://users-api:8005',
 *   timeoutMs: 30_000,
 * });
 *
 * const response = await client.get('/api/v1/users');
 * ```
 *
 * ## Error Handling
 *
 * ```typescript
 * import { isHarborError } from '@elastic-resume-base/harbor';
 *
 * try {
 *   await client.post('/endpoint', payload);
 * } catch (err) {
 *   if (isHarborError(err)) {
 *     // err is an AxiosError — check err.response?.status, err.code, etc.
 *   }
 * }
 * ```
 */
import { type AxiosInstance } from 'axios';
export type { AxiosInstance, AxiosRequestConfig, AxiosResponse, AxiosError as HarborError } from 'axios';
/**
 * Configuration options for creating a HarborClient instance.
 */
export interface HarborClientOptions {
    /** Base URL for all requests made by this client. */
    baseURL: string;
    /** Request timeout in milliseconds. When omitted, no timeout is applied. */
    timeoutMs?: number;
    /** Default headers to include in every request made by this client. */
    defaultHeaders?: Record<string, string>;
}
/**
 * A configured HTTP client for making requests to a downstream service.
 *
 * This type is an alias for `AxiosInstance` and exposes all standard HTTP
 * methods (`get`, `post`, `put`, `patch`, `delete`, `request`, etc.).
 */
export type HarborClient = AxiosInstance;
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
 *
 * @deprecated The procedural interface (`createHarborClient`) is deprecated.
 * Use the object-oriented `HarborClient` class from
 * `@elastic-resume-base/harbor` v3 instead:
 * ```typescript
 * import { HarborClient } from '@elastic-resume-base/harbor/client'; // v3
 * const client = new HarborClient({ baseURL: '...', timeoutMs: 30_000 });
 * ```
 * This v1 export will be removed in a future major version.
 *
 * @example
 * ```typescript
 * const client = createHarborClient({
 *   baseURL: config.documentReaderServiceUrl,
 *   timeoutMs: config.requestTimeoutMs,
 * });
 *
 * const result = await client.post<DocumentReadResponse>('/read', payload);
 * ```
 */
export declare function createHarborClient(options: HarborClientOptions): HarborClient;
/**
 * Determines whether the given value is an error that originated from a
 * HarborClient request (i.e. an Axios-level error).
 *
 * Use this guard in `catch` blocks to distinguish HarborClient errors
 * (network failures, HTTP error responses, timeouts) from other unexpected
 * errors before mapping them to domain-specific error types.
 *
 * This is a re-export of `axios.isAxiosError` provided here so that service
 * modules can avoid a direct `axios` import when they only need error detection.
 *
 * @param err - The value to check.
 * @returns `true` if `err` is a HarborClient (Axios) error.
 *
 * @example
 * ```typescript
 * if (isHarborError(err) && err.code === 'ECONNABORTED') {
 *   throw new UnavailableError('Downstream service unavailable');
 * }
 * ```
 */
export declare const isHarborError: (err: unknown) => err is import('axios').AxiosError;
//# sourceMappingURL=index.d.ts.map