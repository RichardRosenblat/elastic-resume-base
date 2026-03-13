import { Request, Response, NextFunction } from 'express';
import { ZodError, z } from 'zod';
import { errorHandler } from '../../../src/middleware/errorHandler';

describe('errorHandler', () => {
  let req: Partial<Request>;
  let res: Partial<Response>;
  let next: NextFunction;

  beforeEach(() => {
    req = {};
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    next = jest.fn();
  });

  it('handles ZodError with 400 status', () => {
    const schema = z.object({ name: z.string() });
    let zodErr: ZodError | null = null;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodErr = e as ZodError;
    }
    errorHandler(zodErr!, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(400);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.error.code).toBe('VALIDATION_ERROR');
  });

  it('handles generic Error with 500 status', () => {
    const err = new Error('Something went wrong');
    errorHandler(err, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.error.code).toBe('INTERNAL_ERROR');
  });

  it('handles downstream error with its statusCode and code', () => {
    const err = Object.assign(new Error('Service unavailable'), { statusCode: 503, code: 'SERVICE_UNAVAILABLE' });
    errorHandler(err, req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(503);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.error.code).toBe('SERVICE_UNAVAILABLE');
    expect(jsonArg.error.message).toBe('Service unavailable');
  });

  it('handles unknown error with 500 status', () => {
    errorHandler('some string error', req as Request, res as Response, next);
    expect(res.status).toHaveBeenCalledWith(500);
    const jsonArg = (res.json as jest.Mock).mock.calls[0][0];
    expect(jsonArg.success).toBe(false);
    expect(jsonArg.error.code).toBe('INTERNAL_ERROR');
  });
});
