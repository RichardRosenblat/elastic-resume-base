import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
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
  try {
    const response = await client.post<IngestResponse>('/ingest', payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
