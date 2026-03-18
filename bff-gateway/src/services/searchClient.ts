import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
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
  logger.debug({ query: payload.query, limit: payload.limit }, 'search: forwarding request to search service');
  try {
    const response = await client.post<SearchResponse>('/search', payload);
    logger.debug({ resultCount: response.data.results?.length }, 'search: response received from search service');
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    logger.warn({ code: mapped.code, statusCode: mapped.statusCode }, 'search: downstream error from search service');
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
