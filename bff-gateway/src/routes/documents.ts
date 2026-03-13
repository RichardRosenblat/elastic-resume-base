import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { readDocument } from '../services/documentReaderClient';

const router = Router();

const readSchema = z.object({
  fileReference: z.string().min(1),
  options: z.object({
    extractTables: z.boolean().optional(),
    language: z.string().optional(),
  }).optional(),
});

router.post('/read', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = readSchema.parse(req.body);
    const result = await readDocument(body);
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
