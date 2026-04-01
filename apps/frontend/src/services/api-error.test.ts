/**
 * @file api-error.test.ts — Unit tests for api-error helpers.
 *
 * Covers isRateLimitError so that client-side duplicate-request blocks
 * and server-side 429 responses are consistently recognised as rate-limit
 * errors and silently suppressed by useShowApiError.
 */
import { describe, it, expect } from 'vitest';
import { ApiRequestError, DUPLICATE_REQUEST_BLOCKED_CODE, isRateLimitError } from './api-error';

describe('isRateLimitError', () => {
  it('returns true for an HTTP 429 ApiRequestError', () => {
    const error = new ApiRequestError('Too many requests', { status: 429 });
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns true for a RATE_LIMIT_EXCEEDED code error', () => {
    const error = new ApiRequestError('Rate limit exceeded', { code: 'RATE_LIMIT_EXCEEDED' });
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns true for a DUPLICATE_REQUEST_BLOCKED code error', () => {
    const error = new ApiRequestError('Duplicate request blocked', { code: DUPLICATE_REQUEST_BLOCKED_CODE });
    expect(isRateLimitError(error)).toBe(true);
  });

  it('returns false for a generic ApiRequestError with no status or code', () => {
    const error = new ApiRequestError('Something went wrong');
    expect(isRateLimitError(error)).toBe(false);
  });

  it('returns false for a plain Error', () => {
    const error = new Error('Network error');
    expect(isRateLimitError(error)).toBe(false);
  });

  it('returns false for a 400 ApiRequestError', () => {
    const error = new ApiRequestError('Bad request', { status: 400 });
    expect(isRateLimitError(error)).toBe(false);
  });
});
