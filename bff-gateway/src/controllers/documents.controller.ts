import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess } from '@elastic-resume-base/bowltie';
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
  const body = readSchema.parse(request.body);
  const result = await readDocument(body);
  reply.send(formatSuccess(result, request.correlationId));
}
