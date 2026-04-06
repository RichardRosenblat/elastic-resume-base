import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { triggerIngest } from '../services/downloaderClient.js';
import { generateResume } from '../services/fileGeneratorClient.js';

const ingestSchema = z.object({
  sheetId: z.string().optional(),
  batchId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(data => data.sheetId || data.batchId, {
  message: 'Either sheetId or batchId must be provided',
});

const generateSchema = z.object({
  language: z.string().min(2).max(10),
  format: z.enum(['pdf', 'docx', 'html']),
  outputFormats: z.array(z.enum(['pdf', 'docx', 'html'])).optional(),
});

const generateParamsSchema = z.object({
  resumeId: z
    .string()
    .min(1, 'resumeId is required')
    .regex(/^[A-Za-z0-9_-]+$/, 'resumeId contains invalid characters'),
});

type GenerateParams = { resumeId: string };

/** Handles POST /resumes/ingest - triggers a resume ingest job. */
export async function ingest(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'ingest: validating request body');
  const body = ingestSchema.parse(request.body);
  logger.info({ correlationId: request.correlationId, sheetId: body.sheetId, batchId: body.batchId }, 'ingest: triggering ingest job');
  // Include the authenticated user's UID so the DLQ Notifier can route
  // failure notifications to the right user if the ingest fails.
  const result = await triggerIngest({ ...body, userId: request.user.uid });
  logger.debug({ correlationId: request.correlationId, jobId: result.jobId }, 'ingest: job accepted');
  void reply.code(202).send(formatSuccess(result, request.correlationId));
}

/** Handles POST /resumes/:resumeId/generate - triggers resume file generation. */
export async function generate(
  request: FastifyRequest<{ Params: GenerateParams }>,
  reply: FastifyReply,
): Promise<void> {
  let resumeId: string;
  try {
    ({ resumeId } = generateParamsSchema.parse(request.params));
  } catch (err) {
    logger.warn(
      { correlationId: request.correlationId, error: err },
      'generate: invalid resumeId in params',
    );
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'Invalid resumeId'));
    return;
  }
  logger.debug({ correlationId: request.correlationId, resumeId }, 'generate: validating request body');
  const body = generateSchema.parse(request.body);
  logger.info({ correlationId: request.correlationId, resumeId, format: body.format, language: body.language }, 'generate: triggering file generation');
  const result = await generateResume(resumeId, body);
  logger.debug({ correlationId: request.correlationId, resumeId, jobId: result.jobId }, 'generate: generation job accepted');
  void reply.code(202).send(formatSuccess(result, request.correlationId));
}
