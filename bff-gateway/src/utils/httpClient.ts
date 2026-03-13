import axios, { AxiosInstance } from 'axios';
import { config } from '../config';

export function createHttpClient(baseURL: string): AxiosInstance {
  return axios.create({
    baseURL,
    timeout: config.requestTimeoutMs,
    headers: {
      'Content-Type': 'application/json',
    },
  });
}
