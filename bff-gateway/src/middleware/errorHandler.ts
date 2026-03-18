import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors.js';
import { reportError } from '../utils/cloudErrorReporting.js';

/**
 * Fastify error handler.
 * Handles ZodError, AppError, generic Error, and unknown errors.
 */
export function errorHandler(err: Error, request: FastifyRequest, reply: FastifyReply): void {
  const correlationId = request.correlationId;

  if (err instanceof ZodError) {
    reply.code(400).send(formatError('VALIDATION_ERROR', 'Request validation failed', correlationId));
    return;
  }

  if (err instanceof AppError) {
    const isDownstreamError = err.statusCode !== 500;
    if (isDownstreamError) {
      logger.warn(
        { message: err.message, code: err.code, statusCode: err.statusCode, correlationId },
        'Downstream service error',
      );
    } else {
      logger.error({ message: err.message, correlationId }, 'Unhandled AppError');
      reportError(err);
    }
    reply.code(err.statusCode).send(
      formatError(
        err.code,
        isDownstreamError ? err.message : 'An unexpected error occurred',
        correlationId,
      ),
    );
    return;
  }

  const appError = err as Error & { statusCode?: number; code?: string };
  const statusCode = appError.statusCode ?? 500;
  const isDownstreamError = statusCode !== 500;

  if (isDownstreamError) {
    logger.warn(
      { message: err.message, code: appError.code, statusCode, correlationId },
      'Downstream service error',
    );
  } else {
    logger.error({ message: err.message, correlationId }, 'Unhandled error');
    reportError(err);
  }

  reply.code(statusCode).send(
    formatError(
      appError.code ?? 'INTERNAL_ERROR',
      isDownstreamError ? err.message : 'An unexpected error occurred',
      correlationId,
    ),
  );
}
