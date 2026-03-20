import axios from 'axios';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { DocumentReadRequest, DocumentReadResponse } from '../models/index.js';
import { DownstreamError, UnavailableError } from '../errors.js';

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
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ fileReference: payload.fileReference }, 'readDocument: document reader service unavailable');
        throw new UnavailableError('DocumentReader service unavailable');
      }
      if (err.response.status >= 500) {
        logger.warn({ fileReference: payload.fileReference, status: err.response.status }, 'readDocument: document reader service server error');
        throw new UnavailableError('DocumentReader service error');
      }
      throw new DownstreamError('DocumentReader service returned unexpected response');
    }
    throw new DownstreamError('Unexpected error from DocumentReader service');
  }
}
