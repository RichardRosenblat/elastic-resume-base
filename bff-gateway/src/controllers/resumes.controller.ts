import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../models/index.js';
import { triggerIngest } from '../services/downloaderClient.js';
import { generateResume } from '../services/fileGeneratorClient.js';

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

/** Handles POST /resumes/ingest - triggers a resume ingest job. */
export async function ingest(req: Request, res: Response, next: NextFunction): Promise<void> {
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
}

/** Handles POST /resumes/:resumeId/generate - triggers resume file generation. */
export async function generate(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const { resumeId } = req.params;
    const body = generateSchema.parse(req.body);
    const result = await generateResume(resumeId!, body);
    res.status(202).json({
      success: true,
      data: result,
      correlationId: (req as AuthenticatedRequest).correlationId,
    });
  } catch (err) {
    next(err);
  }
}
