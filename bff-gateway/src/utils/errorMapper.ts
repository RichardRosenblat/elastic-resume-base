import { AxiosError } from 'axios';

export interface AppError {
  statusCode: number;
  code: string;
  message: string;
}

export function mapDownstreamError(err: unknown): AppError {
  if (err instanceof AxiosError) {
    const status = err.response?.status ?? 503;
    if (status === 404) return { statusCode: 404, code: 'NOT_FOUND', message: 'Resource not found' };
    if (status === 400) return { statusCode: 400, code: 'BAD_REQUEST', message: 'Invalid request to downstream service' };
    if (status === 401 || status === 403) return { statusCode: 502, code: 'DOWNSTREAM_AUTH_ERROR', message: 'Downstream service authorization error' };
    if (status >= 500) return { statusCode: 502, code: 'DOWNSTREAM_ERROR', message: 'Downstream service error' };
    if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT') {
      return { statusCode: 504, code: 'GATEWAY_TIMEOUT', message: 'Downstream service timed out' };
    }
    if (err.code === 'ECONNREFUSED' || err.code === 'ENOTFOUND') {
      return { statusCode: 503, code: 'SERVICE_UNAVAILABLE', message: 'Downstream service unavailable' };
    }
  }
  return { statusCode: 502, code: 'UPSTREAM_ERROR', message: 'Upstream service error' };
}
