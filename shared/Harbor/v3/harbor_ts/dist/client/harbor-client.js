/**
 * HarborClient — object-oriented HTTP client for Elastic Resume Base services.
 *
 * All outbound HTTP requests should be made through {@link HarborClient}
 * instances to ensure consistent configuration and a stable foundation for
 * future cross-cutting concerns (correlation ID forwarding, retries, etc.).
 *
 * This file is **browser-safe** — it has no Node.js-only dependencies.
 */
import axios from 'axios';
// ─── HarborClient ─────────────────────────────────────────────────────────────
/**
 * An object-oriented HTTP client for communicating with a downstream service.
 *
 * `HarborClient` wraps an Axios instance and pre-applies the options provided
 * at construction time (base URL, timeout, default headers).  Inject it into
 * service-specific client objects to keep each client independently testable
 * and mockable.
 *
 * @example
 * ```typescript
 * import { HarborClient } from '@elastic-resume-base/harbor/client';
 *
 * const client = new HarborClient({
 *   baseURL: 'http://document-reader:8004',
 *   timeoutMs: 30_000,
 * });
 *
 * const response = await client.get<HealthResponse>('/health');
 * ```
 */
export class HarborClient {
    axiosInstance;
    constructor(options) {
        this.axiosInstance = axios.create({
            baseURL: options.baseURL,
            timeout: options.timeoutMs,
            headers: options.defaultHeaders,
        });
    }
    get(url, config) {
        return this.axiosInstance.get(url, config);
    }
    post(url, data, config) {
        return this.axiosInstance.post(url, data, config);
    }
    put(url, data, config) {
        return this.axiosInstance.put(url, data, config);
    }
    patch(url, data, config) {
        return this.axiosInstance.patch(url, data, config);
    }
    delete(url, config) {
        return this.axiosInstance.delete(url, config);
    }
    request(config) {
        return this.axiosInstance.request(config);
    }
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
//# sourceMappingURL=harbor-client.js.map