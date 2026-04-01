import axios from 'axios';
import type { ErrorResponse } from '../types';

interface BowltieErrorDetails {
  code?: string;
  message?: string;
  correlationId?: string;
}

export class ApiRequestError extends Error {
  readonly status?: number;
  readonly code?: string;
  readonly correlationId?: string;

  constructor(message: string, options?: { status?: number; code?: string; correlationId?: string }) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = options?.status;
    this.code = options?.code;
    this.correlationId = options?.correlationId;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function parseBowltieErrorEnvelope(payload: unknown): BowltieErrorDetails | null {
  if (!isObject(payload)) {
    return null;
  }

  const success = payload.success;
  const error = payload.error;
  const meta = payload.meta;

  if (success !== false || !isObject(error)) {
    return null;
  }

  const code = typeof error.code === 'string' ? error.code : undefined;
  const message = typeof error.message === 'string' ? error.message : undefined;
  const correlationId = isObject(meta) && typeof meta.correlationId === 'string'
    ? meta.correlationId
    : undefined;

  return { code, message, correlationId } satisfies BowltieErrorDetails;
}

function normalizeErrorMessage(status: number | undefined, fallback: string): string {
  if (status === undefined) {
    return fallback;
  }
  return `${fallback} (HTTP ${status})`;
}

function toApiRequestErrorFromAxios(error: unknown, fallbackMessage: string): ApiRequestError {
  if (!axios.isAxiosError(error)) {
    if (error instanceof ApiRequestError) {
      return error;
    }
    if (error instanceof Error) {
      return new ApiRequestError(error.message);
    }
    return new ApiRequestError(fallbackMessage);
  }

  const status = error.response?.status;
  const envelope = parseBowltieErrorEnvelope(error.response?.data as ErrorResponse | unknown);
  const message = envelope?.message
    || error.message
    || normalizeErrorMessage(status, fallbackMessage);

  return new ApiRequestError(message, {
    status,
    code: envelope?.code,
    correlationId: envelope?.correlationId,
  });
}

export function ensureApiRequestError(error: unknown, fallbackMessage = 'Request failed'): ApiRequestError {
  return toApiRequestErrorFromAxios(error, fallbackMessage);
}

/**
 * Returns true when the given error represents an HTTP 429 rate-limit response.
 * Works for both Gateway API-level rate limits and downstream rate-limit propagation.
 */
export function isRateLimitError(error: unknown): boolean {
  const normalized = ensureApiRequestError(error, '');
  return normalized.status === 429 || normalized.code === 'RATE_LIMIT_EXCEEDED';
}

export function toUserFacingErrorMessage(
  error: unknown,
  fallbackMessage: string,
  t?: (key: string) => string,
): string {
  const normalized = ensureApiRequestError(error, fallbackMessage);

  let message = normalized.message || fallbackMessage;

  if (t && normalized.code) {
    const translationKey = `errors.${normalized.code}`;
    const translated = t(translationKey);
    // i18next returns the key itself when no translation is found; only
    // replace the message when an actual translation exists.
    if (translated !== translationKey) {
      message = translated;
    }
  }

  if (normalized.correlationId) {
    return `${message} (ref: ${normalized.correlationId})`;
  }

  return message;
}

export async function throwOnFailedResponse(response: Response, fallbackMessage: string): Promise<void> {
  if (response.ok) {
    return;
  }

  let payload: unknown;
  try {
    payload = await response.json();
  } catch {
    payload = null;
  }

  const envelope = parseBowltieErrorEnvelope(payload);
  throw new ApiRequestError(envelope?.message || normalizeErrorMessage(response.status, fallbackMessage), {
    status: response.status,
    code: envelope?.code,
    correlationId: envelope?.correlationId,
  });
}
