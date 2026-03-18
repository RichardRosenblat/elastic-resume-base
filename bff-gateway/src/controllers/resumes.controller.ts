import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
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
  outputFormats: z.array(z.enum(['pdf', 'docx', 'html'])).optional(),
});

type GenerateParams = { resumeId: string };

/** Handles POST /resumes/ingest - triggers a resume ingest job. */
export async function ingest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = ingestSchema.parse(request.body);
  const result = await triggerIngest(body);
  reply.code(202).send(formatSuccess(result, request.correlationId));
}

/** Handles POST /resumes/:resumeId/generate - triggers resume file generation. */
export async function generate(
  request: FastifyRequest<{ Params: GenerateParams }>,
  reply: FastifyReply,
): Promise<void> {
  const resumeId = request.params.resumeId;
  if (!resumeId) {
    reply.code(400).send(formatError('VALIDATION_ERROR', 'resumeId is required'));
    return;
  }
  const body = generateSchema.parse(request.body);
  const result = await generateResume(resumeId, body);
  reply.code(202).send(formatSuccess(result, request.correlationId));
}
