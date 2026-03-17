import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { SearchRequest, SearchResponse } from '../models/index.js';
import { mapDownstreamError } from '../utils/errorMapper.js';
import { DownstreamError } from '../errors.js';

const client = createHttpClient(config.searchBaseServiceUrl);

/**
 * Performs a semantic search via the search service.
 * @param payload - Search request payload.
 * @returns SearchResponse with results.
 */
export async function search(payload: SearchRequest): Promise<SearchResponse> {
  try {
    const response = await client.post<SearchResponse>('/search', payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
