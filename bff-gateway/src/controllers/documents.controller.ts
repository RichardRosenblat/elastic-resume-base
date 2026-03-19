import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { readDocument } from '../services/documentReaderClient.js';

const readSchema = z.object({
  fileReference: z.string().min(1),
  options: z.object({
    extractTables: z.boolean().optional(),
    language: z.string().optional(),
  }).optional(),
});

/** Handles POST /documents/read - reads and extracts text from a document. */
export async function readDocumentHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'readDocumentHandler: validating request body');
  const body = readSchema.parse(request.body);
  logger.info({ correlationId: request.correlationId, fileReference: body.fileReference }, 'readDocumentHandler: reading document');
  const result = await readDocument(body);
  logger.debug({ correlationId: request.correlationId, fileReference: body.fileReference }, 'readDocumentHandler: document read successfully');
  void reply.send(formatSuccess(result, request.correlationId));
}
