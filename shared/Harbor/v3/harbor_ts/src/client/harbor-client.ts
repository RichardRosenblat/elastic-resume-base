/**
 * HarborClient — object-oriented HTTP client for Elastic Resume Base services.
 *
 * All outbound HTTP requests should be made through {@link HarborClient}
 * instances to ensure consistent configuration and a stable foundation for
 * future cross-cutting concerns (correlation ID forwarding, retries, etc.).
 *
 * This file is **browser-safe** — it has no Node.js-only dependencies.
 */

import axios, {
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

/**
 * Configuration options for creating a {@link HarborClient} instance.
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
 * Defines the common async HTTP interface exposed by all Harbor client classes.
 *
 * Program to this interface when accepting Harbor clients via dependency
 * injection so that implementations ({@link HarborClient},
 * {@link IamHarborClient}) can be swapped or mocked freely.
 */
export interface IHarborClient {
  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>>;
  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>>;
  /** Exposes the underlying Axios instance for advanced use (e.g. adding interceptors). */
  readonly axiosInstance: AxiosInstance;
}

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
export class HarborClient implements IHarborClient {
  readonly axiosInstance: AxiosInstance;

  constructor(options: HarborClientOptions) {
    this.axiosInstance = axios.create({
      baseURL: options.baseURL,
      timeout: options.timeoutMs,
      headers: options.defaultHeaders,
    });
  }

  get<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.get<T>(url, config);
  }

  post<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.post<T>(url, data, config);
  }

  put<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.put<T>(url, data, config);
  }

  patch<T = unknown>(
    url: string,
    data?: unknown,
    config?: AxiosRequestConfig,
  ): Promise<AxiosResponse<T>> {
    return this.axiosInstance.patch<T>(url, data, config);
  }

  delete<T = unknown>(url: string, config?: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.delete<T>(url, config);
  }

  request<T = unknown>(config: AxiosRequestConfig): Promise<AxiosResponse<T>> {
    return this.axiosInstance.request<T>(config);
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
export const isHarborError: (err: unknown) => err is import('axios').AxiosError =
  axios.isAxiosError;
