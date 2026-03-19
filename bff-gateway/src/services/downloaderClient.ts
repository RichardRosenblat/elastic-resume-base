import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { IngestRequest, IngestResponse } from '../models/index.js';
import { mapDownstreamError } from '../utils/errorMapper.js';
import { DownstreamError } from '../errors.js';

const client = createHttpClient(config.downloaderServiceUrl);

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
    const mapped = mapDownstreamError(err);
    logger.warn({ code: mapped.code, statusCode: mapped.statusCode }, 'triggerIngest: downstream error from downloader service');
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
