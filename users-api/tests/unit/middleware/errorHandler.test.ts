import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError, z } from 'zod';
import { errorHandler } from '../../../src/middleware/errorHandler.js';
import { AppError } from '../../../src/errors.js';

jest.mock('../../../src/utils/logger', () => ({
  logger: { info: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeMockReply() {
  const reply = {
    code: jest.fn().mockReturnThis(),
    send: jest.fn().mockReturnThis(),
  } as unknown as FastifyReply;
  return reply;
}

function makeMockRequest(correlationId?: string) {
  return { correlationId } as FastifyRequest;
}

describe('errorHandler', () => {
  it('handles ZodError with 400 status and the specific validation message', () => {
    const schema = z.object({ name: z.string() });
    let zodErr: ZodError | null = null;
    try {
      schema.parse({ name: 123 });
    } catch (e) {
      zodErr = e as ZodError;
    }
    const reply = makeMockReply();
    errorHandler(zodErr!, makeMockRequest(), reply);
    expect(reply.code).toHaveBeenCalledWith(400);
    const sendArg = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sendArg.success).toBe(false);
    expect(sendArg.error.code).toBe('VALIDATION_ERROR');
    expect(sendArg.error.message).toBe(zodErr!.message);
  });

  it('handles AppError with its statusCode and code', () => {
    const err = new AppError('Not found', 404, 'NOT_FOUND');
    const reply = makeMockReply();
    errorHandler(err, makeMockRequest(), reply);
    expect(reply.code).toHaveBeenCalledWith(404);
    const sendArg = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sendArg.success).toBe(false);
    expect(sendArg.error.code).toBe('NOT_FOUND');
    expect(sendArg.error.message).toBe('Not found');
  });

  it('handles generic Error with 500 status and a safe message', () => {
    const err = new Error('Something went wrong');
    const reply = makeMockReply();
    errorHandler(err, makeMockRequest(), reply);
    expect(reply.code).toHaveBeenCalledWith(500);
    const sendArg = (reply.send as jest.Mock).mock.calls[0][0];
    expect(sendArg.success).toBe(false);
    expect(sendArg.error.code).toBe('INTERNAL_ERROR');
    expect(sendArg.error.message).toBe('An unexpected error occurred');
  });
});
