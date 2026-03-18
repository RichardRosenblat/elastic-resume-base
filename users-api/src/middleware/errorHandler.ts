import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { AppError } from '@elastic-resume-base/synapse';

/**
 * Fastify error handler.
 * Handles ZodError, AppError, generic Error, and unknown errors.
 */
export function errorHandler(err: Error, request: FastifyRequest, reply: FastifyReply): void {
  const correlationId = request.correlationId;

  if (err instanceof ZodError) {
    reply.code(400).send({
      success: false,
      error: { code: 'VALIDATION_ERROR', message: 'Request validation failed' },
      correlationId,
    });
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ message: err.message, correlationId }, 'Unhandled AppError');
    } else {
      logger.warn(
        { message: err.message, code: err.code, statusCode: err.statusCode, correlationId },
        'Application error',
      );
    }
    reply.code(err.statusCode).send({
      success: false,
      error: {
        code: err.code,
        message: err.statusCode >= 500 ? 'An unexpected error occurred' : err.message,
      },
      correlationId,
    });
    return;
  }

  const appError = err as Error & { statusCode?: number; code?: string };
  const statusCode = appError.statusCode ?? 500;

  if (statusCode >= 500) {
    logger.error({ message: err.message, correlationId }, 'Unhandled error');
  } else {
    logger.warn(
      { message: err.message, code: appError.code, statusCode, correlationId },
      'Application error',
    );
  }

  reply.code(statusCode).send({
    success: false,
    error: {
      code: appError.code ?? 'INTERNAL_ERROR',
      message: statusCode >= 500 ? 'An unexpected error occurred' : err.message,
    },
    correlationId,
  });
}
