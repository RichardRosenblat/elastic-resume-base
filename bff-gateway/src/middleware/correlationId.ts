import { Request, Response, NextFunction } from 'express';
import { v4 as uuidv4 } from 'uuid';

export function correlationIdMiddleware(req: Request, res: Response, next: NextFunction): void {
  const correlationId = (req.headers['x-correlation-id'] as string) || uuidv4();
  (req as Request & { correlationId: string }).correlationId = correlationId;
  res.setHeader('x-correlation-id', correlationId);
  next();
}
