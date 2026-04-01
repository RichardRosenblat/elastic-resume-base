/**
 * Shared types and utilities used by both the Harbor client and server modules.
 *
 * This file is **internal** — consumers should import from `./client` or
 * `./server`, never from this file directly.
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
 * @param err - The value to check.
 * @returns `true` if `err` is a HarborClient (Axios) error.
 */
export declare const isHarborError: (err: unknown) => err is import('axios').AxiosError;
//# sourceMappingURL=shared.d.ts.map