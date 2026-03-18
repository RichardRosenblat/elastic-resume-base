import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { DocumentReadRequest, DocumentReadResponse } from '../models/index.js';
import { mapDownstreamError } from '../utils/errorMapper.js';
import { DownstreamError } from '../errors.js';

const client = createHttpClient(config.documentReaderServiceUrl);

/**
 * Reads and extracts text from a document via the document reader service.
 * @param payload - Document read request payload.
 * @returns DocumentReadResponse with extracted text.
 */
export async function readDocument(payload: DocumentReadRequest): Promise<DocumentReadResponse> {
  logger.debug({ fileReference: payload.fileReference }, 'readDocument: forwarding request to document reader service');
  try {
    const response = await client.post<DocumentReadResponse>('/read', payload);
    logger.debug({ fileReference: payload.fileReference }, 'readDocument: document text extracted successfully');
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    logger.warn({ fileReference: payload.fileReference, code: mapped.code, statusCode: mapped.statusCode }, 'readDocument: downstream error from document reader service');
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
