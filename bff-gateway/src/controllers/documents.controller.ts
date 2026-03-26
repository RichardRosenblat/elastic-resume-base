import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { readDocument, ocrDocuments } from '../services/documentReaderClient.js';

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

/**
 * Handles POST /documents/ocr — proxies a multipart file upload to the
 * document reader OCR service and streams the resulting Excel workbook back
 * to the client.
 *
 * The raw multipart body is forwarded as-is, so the document reader can apply
 * its own validation (file type, size, etc.) and its error responses are
 * surfaced to the frontend through the standard Bowltie error envelope.
 */
export async function ocrDocumentsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const contentType = request.headers['content-type'] ?? '';

  if (!contentType.includes('multipart/form-data')) {
    logger.warn({ correlationId: request.correlationId }, 'ocrDocumentsHandler: request is not multipart/form-data');
    void reply
      .status(400)
      .send(formatError('BAD_REQUEST', 'Expected multipart/form-data upload', request.correlationId));
    return;
  }

  logger.info({ correlationId: request.correlationId }, 'ocrDocumentsHandler: proxying OCR request');

  const { headers: upstreamHeaders, data: excelBuffer } = await ocrDocuments(request.raw, contentType);

  const disposition = (upstreamHeaders['content-disposition'] as string | undefined)
    ?? 'attachment; filename=extracted_documents.xlsx';

  void reply
    .status(200)
    .header('content-type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    .header('content-disposition', disposition)
    .send(excelBuffer);
}
