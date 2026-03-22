import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';

/**
 * Creates a pre-configured Axios HTTP client for a downstream service.
 * Content-Type is set automatically by axios per-request when a body is present
 * (POST/PUT/PATCH with a plain-object payload). It is intentionally omitted here
 * to avoid sending `Content-Type: application/json` on body-less requests such as
 * DELETE and GET, which would cause Fastify to attempt JSON-parsing an empty body
 * and return a 400 error.
 * @param baseURL - The base URL of the downstream service.
 * @returns Configured AxiosInstance.
 */
export function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: config.requestTimeoutMs,
  });
}
