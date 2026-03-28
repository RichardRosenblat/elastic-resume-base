import { isHarborError } from '@elastic-resume-base/harbor';
import type { IncomingMessage } from 'node:http';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { DocumentReadRequest, DocumentReadResponse } from '../models/index.js';
import { DownstreamError, RateLimitError, UnavailableError } from '../errors.js';

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
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ fileReference: payload.fileReference }, 'readDocument: document reader service unavailable');
        throw new UnavailableError('DocumentReader service unavailable');
      }
      if (err.response.status === 429) {
        logger.warn({ fileReference: payload.fileReference }, 'readDocument: document reader service rate limit exceeded');
        throw new RateLimitError();
      }
      if (err.response.status >= 500) {
        logger.warn({ fileReference: payload.fileReference, status: err.response.status }, 'readDocument: document reader service server error');
        throw new UnavailableError('DocumentReader service error');
      }
      throw new DownstreamError('DocumentReader service returned an invalid response format');
    }
    throw new DownstreamError('Unexpected error from DocumentReader service');
  }
}

/**
 * Proxies a multipart OCR request to the document reader service and returns
 * the raw Excel binary together with the response headers.
 *
 * The caller is responsible for forwarding the correct `Content-Type` header
 * (including the multipart boundary) so the document-reader can parse the
 * uploaded files.
 *
 * @param rawBody     - The raw multipart request stream from the incoming HTTP request.
 * @param contentType - The full `Content-Type` header value (e.g.
 *   `multipart/form-data; boundary=----WebKitFormBoundaryXxx`).
 * @returns An object containing the response `headers` and the Excel `data` as
 *   a Buffer.
 * @throws {UnavailableError} When the document reader service cannot be reached.
 * @throws {DownstreamError}  When the document reader service returns an error.
 */
export async function ocrDocuments(
  rawBody: IncomingMessage,
  contentType: string,
): Promise<{ headers: Record<string, string | string[] | undefined>; data: Buffer }> {
  logger.debug('ocrDocuments: proxying multipart OCR request to document reader service');
  try {
    const response = await client.post<Buffer>('/api/v1/documents/ocr', rawBody, {
      headers: { 'content-type': contentType },
      responseType: 'arraybuffer',
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.debug('ocrDocuments: document OCR completed successfully');
    return {
      headers: response.headers as Record<string, string | string[] | undefined>,
      data: Buffer.from(response.data),
    };
  } catch (err) {
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn('ocrDocuments: document reader service unavailable');
        throw new UnavailableError('DocumentReader service unavailable');
      }
      if (err.response.status === 429) {
        logger.warn('ocrDocuments: document reader service rate limit exceeded');
        throw new RateLimitError();
      }
      const responseMessage = (err.response.data as { error?: { message?: string } } | undefined)?.error?.message;
      if (err.response.status >= 500) {
        logger.warn({ status: err.response.status }, 'ocrDocuments: document reader service server error');
        throw new UnavailableError(responseMessage ?? 'DocumentReader service error');
      }
      // Forward 4xx errors (e.g. unsupported file type, file too large) as downstream errors
      throw new DownstreamError(
        responseMessage ?? 'DocumentReader service returned an error',
      );
    }
    throw new DownstreamError('Unexpected error from DocumentReader service');
  }
}
