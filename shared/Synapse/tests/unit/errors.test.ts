import {
  AppError,
  NotFoundError,
  UnauthorizedError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  DownstreamError,
  isAppError,
} from '../../src/errors.js';

describe('Synapse error classes', () => {
  describe('AppError', () => {
    it('stores message, statusCode, and code', () => {
      const err = new AppError('Something went wrong', 500, 'INTERNAL');
      expect(err.message).toBe('Something went wrong');
      expect(err.statusCode).toBe(500);
      expect(err.code).toBe('INTERNAL');
      expect(err.name).toBe('AppError');
    });

    it('is an instance of Error', () => {
      expect(new AppError('msg', 500, 'CODE')).toBeInstanceOf(Error);
    });
  });

  describe('NotFoundError', () => {
    it('has statusCode 404 and code NOT_FOUND', () => {
      const err = new NotFoundError();
      expect(err.statusCode).toBe(404);
      expect(err.code).toBe('NOT_FOUND');
    });

    it('accepts a custom message', () => {
      expect(new NotFoundError('User not found').message).toBe('User not found');
    });

    it('uses default message when none supplied', () => {
      expect(new NotFoundError().message).toBe('Resource not found');
    });
  });

  describe('UnauthorizedError', () => {
    it('has statusCode 401 and code UNAUTHORIZED', () => {
      const err = new UnauthorizedError();
      expect(err.statusCode).toBe(401);
      expect(err.code).toBe('UNAUTHORIZED');
    });
  });

  describe('ValidationError', () => {
    it('has statusCode 400 and code VALIDATION_ERROR', () => {
      const err = new ValidationError();
      expect(err.statusCode).toBe(400);
      expect(err.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('ConflictError', () => {
    it('has statusCode 409 and code CONFLICT', () => {
      const err = new ConflictError();
      expect(err.statusCode).toBe(409);
      expect(err.code).toBe('CONFLICT');
    });
  });

  describe('ForbiddenError', () => {
    it('has statusCode 403 and code FORBIDDEN', () => {
      const err = new ForbiddenError();
      expect(err.statusCode).toBe(403);
      expect(err.code).toBe('FORBIDDEN');
    });
  });

  describe('DownstreamError', () => {
    it('defaults to statusCode 502 and code DOWNSTREAM_ERROR', () => {
      const err = new DownstreamError();
      expect(err.statusCode).toBe(502);
      expect(err.code).toBe('DOWNSTREAM_ERROR');
    });

    it('accepts custom statusCode and code', () => {
      const err = new DownstreamError('Timeout', 504, 'GATEWAY_TIMEOUT');
      expect(err.statusCode).toBe(504);
      expect(err.code).toBe('GATEWAY_TIMEOUT');
    });
  });

  describe('isAppError', () => {
    it('returns true for AppError instances', () => {
      expect(isAppError(new NotFoundError())).toBe(true);
      expect(isAppError(new ValidationError())).toBe(true);
    });

    it('returns false for plain Error', () => {
      expect(isAppError(new Error('plain'))).toBe(false);
    });

    it('returns false for non-error values', () => {
      expect(isAppError(null)).toBe(false);
      expect(isAppError('string')).toBe(false);
      expect(isAppError(42)).toBe(false);
    });
  });
});
