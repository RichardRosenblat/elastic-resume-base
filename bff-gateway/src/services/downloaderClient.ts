import { createHttpClient } from '../utils/httpClient';
import { config } from '../config';
import { IngestRequest, IngestResponse } from '../types';
import { mapDownstreamError } from '../utils/errorMapper';

const client = createHttpClient(config.downloaderServiceUrl);

export async function triggerIngest(payload: IngestRequest): Promise<IngestResponse> {
  try {
    const response = await client.post<IngestResponse>('/ingest', payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw Object.assign(new Error(mapped.message), { statusCode: mapped.statusCode, code: mapped.code });
  }
}
