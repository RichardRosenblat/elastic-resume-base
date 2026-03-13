import { createHttpClient } from '../utils/httpClient';
import { config } from '../config';
import { SearchRequest, SearchResponse } from '../types';
import { mapDownstreamError } from '../utils/errorMapper';

const client = createHttpClient(config.searchBaseServiceUrl);

export async function search(payload: SearchRequest): Promise<SearchResponse> {
  try {
    const response = await client.post<SearchResponse>('/search', payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw Object.assign(new Error(mapped.message), { statusCode: mapped.statusCode, code: mapped.code });
  }
}
