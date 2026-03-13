import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { logger } from '../utils/logger';

export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  const correlationId = (req as Request & { correlationId?: string }).correlationId;

  if (err instanceof ZodError) {
    res.status(400).json({
      success: false,
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: err.errors,
      },
      correlationId,
    });
    return;
  }

  if (err instanceof Error) {
    const appError = err as Error & { statusCode?: number; code?: string };
    const statusCode = appError.statusCode ?? 500;
    const isDownstreamError = statusCode !== 500;

    if (isDownstreamError) {
      logger.warn('Downstream service error', { message: err.message, code: appError.code, statusCode, correlationId });
    } else {
      logger.error('Unhandled error', { message: err.message, correlationId });
    }

    res.status(statusCode).json({
      success: false,
      error: {
        code: appError.code ?? 'INTERNAL_ERROR',
        message: isDownstreamError ? err.message : 'An unexpected error occurred',
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
