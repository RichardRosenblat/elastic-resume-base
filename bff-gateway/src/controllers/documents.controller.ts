import { Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { formatSuccess } from '@elastic-resume-base/bowltie';
import { AuthenticatedRequest } from '../models/index.js';
import { readDocument } from '../services/documentReaderClient.js';

const readSchema = z.object({
  fileReference: z.string().min(1),
  options: z.object({
    extractTables: z.boolean().optional(),
    language: z.string().optional(),
  }).optional(),
});

/** Handles POST /documents/read - reads and extracts text from a document. */
export async function readDocumentHandler(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const body = readSchema.parse(req.body);
    const result = await readDocument(body);
    res.status(200).json(formatSuccess(result, (req as AuthenticatedRequest).correlationId));
  } catch (err) {
    next(err);
  }
}
