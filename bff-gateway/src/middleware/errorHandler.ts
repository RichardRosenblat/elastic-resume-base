import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors.js';
import { reportError } from '../utils/cloudErrorReporting.js';

/**
 * Express error-handling middleware.
 * Handles ZodError, AppError, generic Error, and unknown errors.
 */
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = (req as Request & { correlationId?: string }).correlationId;

  if (err instanceof ZodError) {
    res.status(400).json(formatError('VALIDATION_ERROR', 'Request validation failed', correlationId));
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
    res
      .status(err.statusCode)
      .json(
        formatError(
          err.code,
          isDownstreamError ? err.message : 'An unexpected error occurred',
          correlationId,
        ),
      );
    return;
  }

  if (err instanceof Error) {
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

    res
      .status(statusCode)
      .json(
        formatError(
          appError.code ?? 'INTERNAL_ERROR',
          isDownstreamError ? err.message : 'An unexpected error occurred',
          correlationId,
        ),
      );
    return;
  }

  res
    .status(500)
    .json(formatError('INTERNAL_ERROR', 'An unexpected error occurred', correlationId));
}
