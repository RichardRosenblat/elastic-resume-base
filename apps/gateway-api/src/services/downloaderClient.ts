import { isHarborError } from '@elastic-resume-base/harbor/server';
import type { IncomingMessage } from 'node:http';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { IngestRequest, IngestResponse } from '../models/index.js';
import { DownstreamError, RateLimitError, UnavailableError } from '../errors.js';

const client = createHttpClient(config.ingestorServiceUrl, 'downloader');

/**
 * Triggers a resume ingest job via the downloader service.
 * @param payload - Ingest request payload.
 * @returns IngestResponse with job details.
 */
export async function triggerIngest(payload: IngestRequest): Promise<IngestResponse> {
  logger.debug({ sheetId: payload.sheetId, batchId: payload.batchId }, 'triggerIngest: forwarding request to downloader service');
  try {
    const response = await client.post<IngestResponse>('/api/v1/ingest', payload);
    logger.info({ jobId: response.data.jobId, status: response.data.status }, 'triggerIngest: ingest job accepted');
    return response.data;
  } catch (err) {
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ sheetId: payload.sheetId, batchId: payload.batchId }, 'triggerIngest: downloader service unavailable');
        throw new UnavailableError('Downloader service unavailable');
      }
      if (err.response.status === 429) {
        logger.warn({ sheetId: payload.sheetId, batchId: payload.batchId }, 'triggerIngest: downloader service rate limit exceeded');
        throw new RateLimitError();
      }
      if (err.response.status >= 500) {
        logger.warn({ sheetId: payload.sheetId, batchId: payload.batchId, status: err.response.status }, 'triggerIngest: downloader service server error');
        throw new UnavailableError('Downloader service error');
      }
      throw new DownstreamError('Downloader service returned an invalid response format');
    }
    throw new DownstreamError('Unexpected error from Downloader service');
  }
}

/**
 * Proxies a multipart file upload ingest request to the downloader service.
 *
 * The caller is responsible for forwarding the correct `Content-Type` header
 * (including the multipart boundary) so the downloader service can parse the
 * uploaded file and form fields.
 *
 * @param rawBody     - The raw multipart request stream from the incoming HTTP request.
 * @param contentType - The full `Content-Type` header value (e.g.
 *   `multipart/form-data; boundary=----WebKitFormBoundaryXxx`).
 * @returns The ingestor's response body containing ingestion counts and row-level errors.
 * @throws {UnavailableError} When the downloader service cannot be reached.
 * @throws {DownstreamError}  When the downloader service returns an error.
 */
export async function triggerIngestUpload(
  rawBody: IncomingMessage,
  contentType: string,
): Promise<unknown> {
  logger.debug('triggerIngestUpload: proxying multipart ingest upload to downloader service');
  try {
    const response = await client.post<unknown>('/api/v1/ingest/upload', rawBody, {
      headers: { 'content-type': contentType },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.info('triggerIngestUpload: file ingest completed');
    return response.data;
  } catch (err) {
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn('triggerIngestUpload: downloader service unavailable');
        throw new UnavailableError('Downloader service unavailable');
      }
      if (err.response.status === 429) {
        logger.warn('triggerIngestUpload: downloader service rate limit exceeded');
        throw new RateLimitError();
      }
      const responseMessage = (err.response.data as { error?: { message?: string } } | undefined)?.error?.message;
      if (err.response.status >= 500) {
        logger.warn({ status: err.response.status }, 'triggerIngestUpload: downloader service server error');
        throw new UnavailableError(responseMessage ?? 'Downloader service error');
      }
      throw new DownstreamError(responseMessage ?? 'Downloader service returned an error');
    }
    throw new DownstreamError('Unexpected error from Downloader service');
  }
}
