import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Middleware that logs each HTTP request on response finish.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const correlationId = (req as Request & { correlationId?: string }).correlationId;

  res.on('finish', () => {
    const duration = Date.now() - start;
    logger.info({
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: duration,
      correlationId,
    }, 'HTTP request');
  });

  next();
}
