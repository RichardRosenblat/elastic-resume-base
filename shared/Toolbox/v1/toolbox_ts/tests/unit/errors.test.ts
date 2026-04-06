/**
 * Unit tests for toolbox_ts errors module.
 */

import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  DownstreamError,
  UnavailableError,
  RateLimitError,
  isAppError,
} from '../../src/index.js';

describe('AppError', () => {
  it('stores message on the instance', () => {
    const err = new AppError('something went wrong', 500, 'INTERNAL_ERROR');
    expect(err.message).toBe('something went wrong');
  });

  it('stores statusCode on the instance', () => {
    const err = new AppError('error', 503, 'MY_CODE');
    expect(err.statusCode).toBe(503);
  });

  it('stores code on the instance', () => {
    const err = new AppError('error', 400, 'MY_CODE');
    expect(err.code).toBe('MY_CODE');
  });

  it('is an instance of Error', () => {
    const err = new AppError('oops', 500, 'INTERNAL_ERROR');
    expect(err).toBeInstanceOf(Error);
  });

  it('can be thrown as a standard error', () => {
    expect(() => {
      throw new AppError('test', 500, 'INTERNAL_ERROR');
    }).toThrow('test');
  });

  it('sets name to the constructor name', () => {
    const err = new AppError('msg', 500, 'CODE');
    expect(err.name).toBe('AppError');
  });
});

describe('NotFoundError', () => {
  it('has statusCode 404', () => {
    expect(new NotFoundError().statusCode).toBe(404);
  });

  it('has code NOT_FOUND', () => {
    expect(new NotFoundError().code).toBe('NOT_FOUND');
  });

  it('accepts a custom message', () => {
    const err = new NotFoundError('Resume xyz not found');
    expect(err.message).toBe('Resume xyz not found');
  });

  it('uses a default message when none is provided', () => {
    const err = new NotFoundError();
    expect(err.message).toBe('Resource not found');
  });

  it('is an instance of AppError', () => {
    expect(new NotFoundError()).toBeInstanceOf(AppError);
  });
});

describe('UnauthorizedError', () => {
  it('has statusCode 401', () => {
    expect(new UnauthorizedError().statusCode).toBe(401);
  });

  it('has code UNAUTHORIZED', () => {
    expect(new UnauthorizedError().code).toBe('UNAUTHORIZED');
  });
});

describe('ValidationError', () => {
  it('has statusCode 400', () => {
    expect(new ValidationError().statusCode).toBe(400);
  });

  it('has code VALIDATION_ERROR', () => {
    expect(new ValidationError().code).toBe('VALIDATION_ERROR');
  });
});

describe('ConflictError', () => {
  it('has statusCode 409', () => {
    expect(new ConflictError().statusCode).toBe(409);
  });

  it('has code CONFLICT', () => {
    expect(new ConflictError().code).toBe('CONFLICT');
  });
});

describe('ForbiddenError', () => {
  it('has statusCode 403', () => {
    expect(new ForbiddenError().statusCode).toBe(403);
  });

  it('has code FORBIDDEN', () => {
    expect(new ForbiddenError().code).toBe('FORBIDDEN');
  });
});

describe('DownstreamError', () => {
  it('has default statusCode 502', () => {
    expect(new DownstreamError().statusCode).toBe(502);
  });

  it('has default code DOWNSTREAM_ERROR', () => {
    expect(new DownstreamError().code).toBe('DOWNSTREAM_ERROR');
  });
});

describe('UnavailableError', () => {
  it('has statusCode 503', () => {
    expect(new UnavailableError().statusCode).toBe(503);
  });

  it('has code SERVICE_UNAVAILABLE', () => {
    expect(new UnavailableError().code).toBe('SERVICE_UNAVAILABLE');
  });
});

describe('RateLimitError', () => {
  it('has statusCode 429', () => {
    expect(new RateLimitError().statusCode).toBe(429);
  });

  it('has code RATE_LIMIT_EXCEEDED', () => {
    expect(new RateLimitError().code).toBe('RATE_LIMIT_EXCEEDED');
  });
});

describe('isAppError', () => {
  it('returns true for an AppError instance', () => {
    expect(isAppError(new AppError('x', 500, 'CODE'))).toBe(true);
  });

  it('returns true for a subclass of AppError', () => {
    expect(isAppError(new NotFoundError())).toBe(true);
  });

  it('returns false for a plain Error', () => {
    expect(isAppError(new Error('plain'))).toBe(false);
  });

  it('returns false for a non-error value', () => {
    expect(isAppError('not an error')).toBe(false);
    expect(isAppError(null)).toBe(false);
    expect(isAppError(42)).toBe(false);
  });

  it('returns true for all AppError subclasses', () => {
    const subclasses = [
      new NotFoundError(),
      new UnauthorizedError(),
      new ValidationError(),
      new ConflictError(),
      new ForbiddenError(),
      new DownstreamError(),
      new UnavailableError(),
      new RateLimitError(),
    ];
    for (const err of subclasses) {
      expect(isAppError(err)).toBe(true);
    }
  });
});
