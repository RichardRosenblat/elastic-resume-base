import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors.js';

/**
 * Fastify error handler.
 * Handles ZodError, AppError, generic Error, and unknown errors.
 * Reports 5xx errors at `error` level; 4xx errors at `warn` level.
 */
export function errorHandler(err: Error, request: FastifyRequest, reply: FastifyReply): void {
  const correlationId = request.correlationId;

  if (err instanceof ZodError) {
    logger.warn({ correlationId, issues: err.issues }, 'Request validation failed');
    void reply.code(400).send(formatError('VALIDATION_ERROR', err.message, correlationId));
    return;
  }

  if (err instanceof AppError) {
    if (err.statusCode >= 500) {
      logger.error({ message: err.message, code: err.code, statusCode: err.statusCode, correlationId }, 'Unhandled AppError');
    } else {
      logger.warn({ message: err.message, code: err.code, statusCode: err.statusCode, correlationId }, 'Application error');
    }
    void reply.code(err.statusCode).send(
      formatError(
        err.code,
        err.statusCode >= 500 ? 'An unexpected error occurred' : err.message,
        correlationId,
      ),
    );
    return;
  }

  const appError = err as Error & { statusCode?: number; code?: string };
  const statusCode = appError.statusCode ?? 500;

  if (statusCode >= 500) {
    logger.error({ message: err.message, code: appError.code, statusCode, correlationId }, 'Unhandled error');
  } else {
    logger.warn({ message: err.message, code: appError.code, statusCode, correlationId }, 'Application error');
  }

  void reply.code(statusCode).send(
    formatError(
      appError.code ?? 'INTERNAL_ERROR',
      statusCode >= 500 ? 'An unexpected error occurred' : err.message,
      correlationId,
    ),
  );
}

