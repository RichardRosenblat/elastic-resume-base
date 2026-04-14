import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { triggerIngest, triggerIngestUpload, triggerIngestDriveLink, triggerIngestSingleFile } from '../services/downloaderClient.js';
import { generateResume } from '../services/fileGeneratorClient.js';

const ingestSchema = z.object({
  sheetId: z.string().optional(),
  sheetUrl: z.string().optional(),
  batchId: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).refine(data => data.sheetId || data.sheetUrl || data.batchId, {
  message: 'Either sheetId, sheetUrl, or batchId must be provided',
});

const ingestDriveLinkSchema = z.object({
  driveLink: z.string().min(1, 'driveLink is required'),
  metadata: z.record(z.string(), z.unknown()).optional(),
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
  logger.info({ correlationId: request.correlationId, sheetId: body.sheetId, sheetUrl: body.sheetUrl, batchId: body.batchId }, 'ingest: triggering ingest job');
  // Include the authenticated user's UID so the DLQ Notifier can route
  // failure notifications to the right user if the ingest fails.
  const result = await triggerIngest({ ...body, userId: request.user.uid });
  logger.debug({ correlationId: request.correlationId, ingested: result.ingested }, 'ingest: completed');
  void reply.code(202).send(formatSuccess(result, request.correlationId));
}

/**
 * Handles POST /resumes/ingest/upload — proxies a multipart file upload to the
 * ingestor service and returns the ingestion results to the client.
 *
 * The raw multipart body (Excel or CSV file plus optional form fields) is
 * forwarded as-is so the ingestor can apply its own validation.
 */
export async function ingestUpload(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const contentType = request.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    logger.warn({ correlationId: request.correlationId }, 'ingestUpload: request is not multipart/form-data');
    void reply
      .status(400)
      .send(formatError('BAD_REQUEST', 'Expected multipart/form-data upload', request.correlationId));
    return;
  }

  logger.info({ correlationId: request.correlationId }, 'ingestUpload: proxying file upload to ingestor service');
  const result = await triggerIngestUpload(request.raw, contentType);
  logger.debug({ correlationId: request.correlationId }, 'ingestUpload: file ingest completed');
  void reply.code(200).send(formatSuccess(result, request.correlationId));
}

/**
 * Handles POST /resumes/ingest/drive — ingests a single resume from a Google Drive link.
 */
export async function ingestDriveLink(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'ingestDriveLink: validating request body');
  const body = ingestDriveLinkSchema.parse(request.body);
  logger.info({ correlationId: request.correlationId, driveLink: body.driveLink }, 'ingestDriveLink: triggering Drive-link ingest');
  const result = await triggerIngestDriveLink({ ...body, userId: request.user.uid });
  logger.debug({ correlationId: request.correlationId, ingested: result.ingested }, 'ingestDriveLink: completed');
  void reply.code(200).send(formatSuccess(result, request.correlationId));
}

/**
 * Handles POST /resumes/ingest/file — proxies a single PDF or DOCX file upload to the
 * ingestor service for direct ingestion.
 */
export async function ingestSingleFile(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const contentType = request.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    logger.warn({ correlationId: request.correlationId }, 'ingestSingleFile: request is not multipart/form-data');
    void reply
      .status(400)
      .send(formatError('BAD_REQUEST', 'Expected multipart/form-data upload', request.correlationId));
    return;
  }

  logger.info({ correlationId: request.correlationId }, 'ingestSingleFile: proxying single file upload to ingestor service');
  const result = await triggerIngestSingleFile(request.raw, contentType);
  logger.debug({ correlationId: request.correlationId, ingested: result.ingested }, 'ingestSingleFile: completed');
  void reply.code(200).send(formatSuccess(result, request.correlationId));
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
