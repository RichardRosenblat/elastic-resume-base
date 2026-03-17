import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger.js';
import { AppError } from '@elastic-resume-base/synapse';

/**
 * Express error-handling middleware.
 * Handles ZodError, AppError, generic Error, and unknown errors.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  const correlationId = (req as Request & { correlationId?: string }).correlationId;

  if (err instanceof ZodError) {
    res.status(400).json({
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
    res.status(err.statusCode).json({
      success: false,
      error: {
        code: err.code,
        message: err.statusCode >= 500 ? 'An unexpected error occurred' : err.message,
      },
      correlationId,
    });
    return;
  }

  if (err instanceof Error) {
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

    res.status(statusCode).json({
      success: false,
      error: {
        code: appError.code ?? 'INTERNAL_ERROR',
        message: statusCode >= 500 ? 'An unexpected error occurred' : err.message,
      },
      correlationId,
    });
    return;
  }

  res.status(500).json({
    success: false,
    error: { code: 'INTERNAL_ERROR', message: 'An unexpected error occurred' },
    correlationId,
  });
}
