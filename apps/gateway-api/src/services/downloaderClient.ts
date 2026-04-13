import { isHarborError } from '@elastic-resume-base/harbor/server';
import type { IncomingMessage } from 'node:http';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { IngestRequest, IngestResponse, DriveLinkIngestRequest, SingleIngestResponse } from '../models/index.js';
import { DownstreamError, RateLimitError, UnavailableError } from '../errors.js';

const client = createHttpClient(config.ingestorServiceUrl, 'ingestor', config.ingestorServiceTimeoutMs);

/**
 * Triggers a resume ingest job via the ingestor service.
 * @param payload - Ingest request payload.
 * @returns IngestResponse with job details.
 */
export async function triggerIngest(payload: IngestRequest): Promise<IngestResponse> {
  logger.debug({ sheetId: payload.sheetId, batchId: payload.batchId }, 'triggerIngest: forwarding request to ingestor service');
  try {
    const response = await client.post<IngestResponse>('/api/v1/ingest', payload);
    logger.info({ jobId: response.data.jobId, status: response.data.status }, 'triggerIngest: ingest job accepted');
    return response.data;
  } catch (err) {
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ sheetId: payload.sheetId, batchId: payload.batchId, errorCode: err.code, errorMessage: err.message }, 'triggerIngest: ingestor service unavailable');
        throw new UnavailableError('Ingestor service unavailable');
      }
      if (err.response.status === 429) {
        logger.warn({ sheetId: payload.sheetId, batchId: payload.batchId }, 'triggerIngest: ingestor service rate limit exceeded');
        throw new RateLimitError();
      }
      if (err.response.status >= 500) {
        logger.warn({ sheetId: payload.sheetId, batchId: payload.batchId, status: err.response.status }, 'triggerIngest: ingestor service server error');
        throw new UnavailableError('Ingestor service error');
      }
      throw new DownstreamError('Ingestor service returned an invalid response format');
    }
    throw new DownstreamError('Unexpected error from Ingestor service');
  }
}

/**
 * Proxies a multipart file upload ingest request to the ingestor service.
 *
 * The caller is responsible for forwarding the correct `Content-Type` header
 * (including the multipart boundary) so the ingestor service can parse the
 * uploaded file and form fields.
 *
 * @param rawBody     - The raw multipart request stream from the incoming HTTP request.
 * @param contentType - The full `Content-Type` header value (e.g.
 *   `multipart/form-data; boundary=----WebKitFormBoundaryXxx`).
 * @returns The ingestor's response body containing ingestion counts and row-level errors.
 * @throws {UnavailableError} When the ingestor service cannot be reached.
 * @throws {DownstreamError}  When the ingestor service returns an error.
 */
export async function triggerIngestUpload(
  rawBody: IncomingMessage,
  contentType: string,
): Promise<unknown> {
  logger.debug('triggerIngestUpload: proxying multipart ingest upload to ingestor service');
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
        logger.warn({ errorCode: err.code, errorMessage: err.message }, 'triggerIngestUpload: ingestor service unavailable');
        throw new UnavailableError('Ingestor service unavailable');
      }
      if (err.response.status === 429) {
        logger.warn('triggerIngestUpload: ingestor service rate limit exceeded');
        throw new RateLimitError();
      }
      const responseMessage = (err.response.data as { error?: { message?: string } } | undefined)?.error?.message;
      if (err.response.status >= 500) {
        logger.warn({ status: err.response.status }, 'triggerIngestUpload: ingestor service server error');
        throw new UnavailableError(responseMessage ?? 'Ingestor service error');
      }
      throw new DownstreamError(responseMessage ?? 'Ingestor service returned an error');
    }
    throw new DownstreamError('Unexpected error from Ingestor service');
  }
}

/**
 * Triggers ingestion of a single resume from a Google Drive link.
 *
 * @param payload - Drive-link ingest request payload.
 * @returns SingleIngestResponse with the resulting resume ID and any errors.
 */
export async function triggerIngestDriveLink(payload: DriveLinkIngestRequest): Promise<SingleIngestResponse> {
  logger.debug({ driveLink: payload.driveLink }, 'triggerIngestDriveLink: forwarding request to ingestor service');
  try {
    const response = await client.post<SingleIngestResponse>('/api/v1/ingest/drive', payload);
    logger.info({ ingested: response.data.ingested }, 'triggerIngestDriveLink: drive-link ingest completed');
    return response.data;
  } catch (err) {
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ driveLink: payload.driveLink }, 'triggerIngestDriveLink: ingestor service unavailable');
        throw new UnavailableError('Ingestor service unavailable');
      }
      if (err.response.status === 429) {
        throw new RateLimitError();
      }
      const responseMessage = (err.response.data as { error?: { message?: string } } | undefined)?.error?.message;
      if (err.response.status >= 500) {
        throw new UnavailableError(responseMessage ?? 'Ingestor service error');
      }
      throw new DownstreamError(responseMessage ?? 'Ingestor service returned an error');
    }
    throw new DownstreamError('Unexpected error from Ingestor service');
  }
}

/**
 * Proxies a single resume file upload to the ingestor service.
 *
 * @param rawBody     - The raw multipart request stream.
 * @param contentType - The full Content-Type header value.
 * @returns SingleIngestResponse with the resulting resume ID and any errors.
 */
export async function triggerIngestSingleFile(
  rawBody: IncomingMessage,
  contentType: string,
): Promise<SingleIngestResponse> {
  logger.debug('triggerIngestSingleFile: proxying single file upload to ingestor service');
  try {
    const response = await client.post<SingleIngestResponse>('/api/v1/ingest/file', rawBody, {
      headers: { 'content-type': contentType },
      maxBodyLength: Infinity,
      maxContentLength: Infinity,
    });
    logger.info({ ingested: response.data.ingested }, 'triggerIngestSingleFile: file ingest completed');
    return response.data;
  } catch (err) {
    if (isHarborError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn('triggerIngestSingleFile: ingestor service unavailable');
        throw new UnavailableError('Ingestor service unavailable');
      }
      if (err.response.status === 429) {
        throw new RateLimitError();
      }
      const responseMessage = (err.response.data as { error?: { message?: string } } | undefined)?.error?.message;
      if (err.response.status >= 500) {
        throw new UnavailableError(responseMessage ?? 'Ingestor service error');
      }
      throw new DownstreamError(responseMessage ?? 'Ingestor service returned an error');
    }
    throw new DownstreamError('Unexpected error from Ingestor service');
  }
}
