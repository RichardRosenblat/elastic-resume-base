import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types';
import { triggerIngest } from '../services/downloaderClient';
import { generateResume } from '../services/fileGeneratorClient';

const router = Router();

const ingestSchema = z.object({
  sheetId: z.string().optional(),
  batchId: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
}).refine(data => data.sheetId || data.batchId, {
  message: 'Either sheetId or batchId must be provided',
});

const generateSchema = z.object({
  language: z.string().min(2).max(10),
  format: z.enum(['pdf', 'docx', 'html']),
});

router.post('/ingest', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const body = ingestSchema.parse(req.body);
    const result = await triggerIngest(body);
    res.status(202).json({
      success: true,
      data: result,
      correlationId: (req as AuthenticatedRequest).correlationId,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/:resumeId/generate', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { resumeId } = req.params;
    const body = generateSchema.parse(req.body);
    const result = await generateResume(resumeId, body);
    res.status(202).json({
      success: true,
      data: result,
      correlationId: (req as AuthenticatedRequest).correlationId,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
