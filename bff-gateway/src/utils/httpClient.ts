import axios, { AxiosInstance } from 'axios';
import { config } from '../config.js';

/**
 * Creates a pre-configured Axios HTTP client for a downstream service.
 * @param baseURL - The base URL of the downstream service.
 * @returns Configured AxiosInstance.
 */
export function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: config.requestTimeoutMs,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
