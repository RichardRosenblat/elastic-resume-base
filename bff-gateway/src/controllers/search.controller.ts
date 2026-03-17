import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../models/index.js';
import { search } from '../services/searchClient.js';

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/** Handles POST /search - performs a semantic search. */
export async function searchHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
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
}
