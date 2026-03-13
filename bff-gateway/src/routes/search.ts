import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { search } from '../services/searchClient';

const router = Router();

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

router.post('/', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = searchSchema.parse(req.body);
    const result = await search(body);
    res.status(200).json({
      success: true,
      data: result,
      correlationId: (req as AuthenticatedRequest).correlationId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
