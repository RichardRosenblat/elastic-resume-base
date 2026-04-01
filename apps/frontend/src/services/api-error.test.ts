/**
 * @file api-error.test.ts — Unit tests for api-error utility functions.
 *
 * Covers:
 * - Bowltie error envelope parsing
 * - `ensureApiRequestError` normalisation
 * - `toUserFacingErrorMessage` — raw message, i18n translation, and correlation ID formatting
 * - `isRateLimitError`
 * - `throwOnFailedResponse`
 */
import { describe, it, expect, vi } from 'vitest';
import axios from 'axios';

// ─── Module mock (must be hoisted) ───────────────────────────────────────────

vi.mock('axios', async (importOriginal) => {
  const actual = await importOriginal<typeof import('axios')>();
  return {
    ...actual,
    default: {
      ...actual.default,
      isAxiosError: actual.default.isAxiosError,
    },
  };
});

// ─── Imports after mocks ──────────────────────────────────────────────────────

import {
  ApiRequestError,
  ensureApiRequestError,
  isRateLimitError,
  toUserFacingErrorMessage,
  throwOnFailedResponse,
} from './api-error';

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Builds a minimal Axios-like error with a structured Bowltie response body. */
function makeAxiosError(
  status: number,
  responseData: unknown,
  message = 'Request failed',
): ReturnType<typeof axios.isAxiosError> extends boolean ? never : unknown {
  const error = new Error(message) as Error & {
    isAxiosError: boolean;
    response: { status: number; data: unknown };
  };
  error.isAxiosError = true;
  error.response = { status, data: responseData };
  return error;
}

/** Creates a valid Bowltie error envelope. */
function bowltieEnvelope(code: string, message: string, correlationId?: string) {
  return {
    success: false,
    error: { code, message },
    meta: { correlationId, timestamp: new Date().toISOString() },
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('ApiRequestError', () => {
  it('stores status, code, and correlationId', () => {
    const err = new ApiRequestError('oops', { status: 400, code: 'VALIDATION_ERROR', correlationId: 'abc' });
    expect(err.message).toBe('oops');
    expect(err.status).toBe(400);
    expect(err.code).toBe('VALIDATION_ERROR');
    expect(err.correlationId).toBe('abc');
    expect(err.name).toBe('ApiRequestError');
  });

  it('works with no options', () => {
    const err = new ApiRequestError('plain');
    expect(err.status).toBeUndefined();
    expect(err.code).toBeUndefined();
    expect(err.correlationId).toBeUndefined();
  });
});

// ─── ensureApiRequestError ────────────────────────────────────────────────────

describe('ensureApiRequestError', () => {
  it('passes through an existing ApiRequestError unchanged', () => {
    const original = new ApiRequestError('original', { status: 404 });
    expect(ensureApiRequestError(original)).toBe(original);
  });

  it('wraps a generic Error', () => {
    const err = ensureApiRequestError(new Error('generic'));
    expect(err).toBeInstanceOf(ApiRequestError);
    expect(err.message).toBe('generic');
  });

  it('returns fallback message for non-Error values', () => {
    const err = ensureApiRequestError('string error', 'fallback');
    expect(err.message).toBe('fallback');
  });

  it('parses a Bowltie Axios error envelope', () => {
    const axiosErr = makeAxiosError(401, bowltieEnvelope('UNAUTHORIZED', 'Authentication required', 'corr-1'));
    const err = ensureApiRequestError(axiosErr);
    expect(err.status).toBe(401);
    expect(err.code).toBe('UNAUTHORIZED');
    expect(err.message).toBe('Authentication required');
    expect(err.correlationId).toBe('corr-1');
  });

  it('falls back to axios message when envelope is absent', () => {
    const axiosErr = makeAxiosError(500, null, 'Network Error');
    const err = ensureApiRequestError(axiosErr, 'fallback');
    expect(err.message).toBe('Network Error');
    expect(err.code).toBeUndefined();
  });
});

// ─── isRateLimitError ─────────────────────────────────────────────────────────

describe('isRateLimitError', () => {
  it('returns true for HTTP 429', () => {
    const axiosErr = makeAxiosError(429, bowltieEnvelope('RATE_LIMIT_EXCEEDED', 'Too many requests'));
    expect(isRateLimitError(axiosErr)).toBe(true);
  });

  it('returns true when code is RATE_LIMIT_EXCEEDED regardless of status', () => {
    const err = new ApiRequestError('msg', { status: 400, code: 'RATE_LIMIT_EXCEEDED' });
    expect(isRateLimitError(err)).toBe(true);
  });

  it('returns false for other errors', () => {
    const axiosErr = makeAxiosError(403, bowltieEnvelope('FORBIDDEN', 'Forbidden'));
    expect(isRateLimitError(axiosErr)).toBe(false);
  });
});

// ─── toUserFacingErrorMessage ─────────────────────────────────────────────────

describe('toUserFacingErrorMessage', () => {
  // Build a simple t() stub that simulates i18next behaviour:
  // - returns the translated string when a mapping exists
  // - returns the key itself when no mapping exists
  const translations: Record<string, string> = {
    'errors.VALIDATION_ERROR': 'The provided data is invalid. Please check your input and try again.',
    'errors.UNAUTHORIZED': 'Authentication is required. Please sign in and try again.',
    'errors.FORBIDDEN': 'You do not have permission to perform this action.',
    'errors.NOT_FOUND': 'The requested resource was not found.',
    'errors.CONFLICT': 'A conflict occurred. The resource may already exist.',
    'errors.RATE_LIMIT_EXCEEDED': 'Too many requests. Please wait a moment and try again.',
    'errors.DOWNSTREAM_ERROR': 'A downstream service returned an unexpected response. Please try again later.',
    'errors.SERVICE_UNAVAILABLE': 'The service is currently unavailable. Please try again later.',
    'errors.INTERNAL_ERROR': 'An unexpected error occurred. Please try again later.',
    'errors.unknown': 'An error occurred. Please try again.',
  };

  const t = (key: string) => translations[key] ?? key;

  it('returns the raw API message when no t() is provided', () => {
    const axiosErr = makeAxiosError(400, bowltieEnvelope('VALIDATION_ERROR', 'Raw validation message'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback')).toBe('Raw validation message');
  });

  it('uses the i18n translation for a known error code when t() is provided', () => {
    const axiosErr = makeAxiosError(400, bowltieEnvelope('VALIDATION_ERROR', 'Raw validation message'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'The provided data is invalid. Please check your input and try again.',
    );
  });

  it('translates UNAUTHORIZED (401)', () => {
    const axiosErr = makeAxiosError(401, bowltieEnvelope('UNAUTHORIZED', 'Unauthenticated'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'Authentication is required. Please sign in and try again.',
    );
  });

  it('translates FORBIDDEN (403)', () => {
    const axiosErr = makeAxiosError(403, bowltieEnvelope('FORBIDDEN', 'No access'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'You do not have permission to perform this action.',
    );
  });

  it('translates NOT_FOUND (404)', () => {
    const axiosErr = makeAxiosError(404, bowltieEnvelope('NOT_FOUND', 'Resource missing'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'The requested resource was not found.',
    );
  });

  it('translates RATE_LIMIT_EXCEEDED (429)', () => {
    const axiosErr = makeAxiosError(429, bowltieEnvelope('RATE_LIMIT_EXCEEDED', 'Too many'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'Too many requests. Please wait a moment and try again.',
    );
  });

  it('translates INTERNAL_ERROR (500)', () => {
    const axiosErr = makeAxiosError(500, bowltieEnvelope('INTERNAL_ERROR', 'Something broke'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'An unexpected error occurred. Please try again later.',
    );
  });

  it('falls back to the raw API message for unknown error codes', () => {
    const axiosErr = makeAxiosError(418, bowltieEnvelope('I_AM_A_TEAPOT', 'I am a teapot'));
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe('I am a teapot');
  });

  it('falls back to fallbackMessage when there is no API message and no translation', () => {
    const err = new ApiRequestError('', { status: 418, code: 'I_AM_A_TEAPOT' });
    expect(toUserFacingErrorMessage(err, 'Fallback', t)).toBe('Fallback');
  });

  it('appends correlationId when present', () => {
    const axiosErr = makeAxiosError(
      400,
      bowltieEnvelope('VALIDATION_ERROR', 'Raw validation message', 'corr-42'),
    );
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback', t)).toBe(
      'The provided data is invalid. Please check your input and try again. (ref: corr-42)',
    );
  });

  it('appends correlationId without t() too', () => {
    const axiosErr = makeAxiosError(
      400,
      bowltieEnvelope('VALIDATION_ERROR', 'Raw message', 'corr-99'),
    );
    expect(toUserFacingErrorMessage(axiosErr, 'Fallback')).toBe('Raw message (ref: corr-99)');
  });

  it('uses Spanish translation when t() provides Spanish strings', () => {
    const esTranslations: Record<string, string> = {
      'errors.UNAUTHORIZED': 'Se requiere autenticación. Por favor, inicia sesión e inténtalo de nuevo.',
    };
    const tEs = (key: string) => esTranslations[key] ?? key;
    const axiosErr = makeAxiosError(401, bowltieEnvelope('UNAUTHORIZED', 'Unauthenticated'));
    expect(toUserFacingErrorMessage(axiosErr, 'Error', tEs)).toBe(
      'Se requiere autenticación. Por favor, inicia sesión e inténtalo de nuevo.',
    );
  });

  it('uses pt-BR translation when t() provides Portuguese strings', () => {
    const ptTranslations: Record<string, string> = {
      'errors.FORBIDDEN': 'Você não tem permissão para realizar esta ação.',
    };
    const tPt = (key: string) => ptTranslations[key] ?? key;
    const axiosErr = makeAxiosError(403, bowltieEnvelope('FORBIDDEN', 'No access'));
    expect(toUserFacingErrorMessage(axiosErr, 'Error', tPt)).toBe(
      'Você não tem permissão para realizar esta ação.',
    );
  });
});

// ─── throwOnFailedResponse ────────────────────────────────────────────────────

describe('throwOnFailedResponse', () => {
  it('does not throw for a 200 OK response', async () => {
    const response = new Response(null, { status: 200 });
    await expect(throwOnFailedResponse(response, 'Fallback')).resolves.toBeUndefined();
  });

  it('throws ApiRequestError for a non-ok response with a Bowltie envelope', async () => {
    const body = JSON.stringify(bowltieEnvelope('NOT_FOUND', 'Resource not found', 'corr-7'));
    const response = new Response(body, {
      status: 404,
      headers: { 'Content-Type': 'application/json' },
    });
    await expect(throwOnFailedResponse(response, 'Fallback')).rejects.toMatchObject({
      message: 'Resource not found',
      status: 404,
      code: 'NOT_FOUND',
      correlationId: 'corr-7',
    });
  });

  it('throws with fallback message when body is not valid JSON', async () => {
    const response = new Response('not-json', { status: 503 });
    await expect(throwOnFailedResponse(response, 'Service error')).rejects.toMatchObject({
      message: 'Service error (HTTP 503)',
      status: 503,
    });
  });
});
