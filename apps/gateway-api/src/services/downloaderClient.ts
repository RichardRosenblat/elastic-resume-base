import { isHarborError } from '@elastic-resume-base/harbor/server';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { IngestRequest, IngestResponse } from '../models/index.js';
import { DownstreamError, RateLimitError, UnavailableError } from '../errors.js';

const client = createHttpClient(config.ingestorServiceUrl);

/**
 * Triggers a resume ingest job via the downloader service.
 * @param payload - Ingest request payload.
 * @returns IngestResponse with job details.
 */
export async function triggerIngest(payload: IngestRequest): Promise<IngestResponse> {
  logger.debug({ sheetId: payload.sheetId, batchId: payload.batchId }, 'triggerIngest: forwarding request to downloader service');
  try {
    const response = await client.post<IngestResponse>('/ingest', payload);
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
