import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';
import type { CorrelatedRequest } from '../models/index.js';

/**
 * Middleware that attaches a correlation ID to each request.
 * Uses the incoming `x-correlation-id` header or generates a new UUID.
 */
export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  (req as CorrelatedRequest).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
