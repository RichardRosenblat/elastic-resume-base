import axios from 'axios';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { SearchRequest, SearchResponse } from '../models/index.js';
import { DownstreamError, UnavailableError } from '../errors.js';

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
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ query: payload.query }, 'search: search service unavailable');
        throw new UnavailableError('Search service unavailable');
      }
      if (err.response.status >= 500) {
        logger.warn({ query: payload.query, status: err.response.status }, 'search: search service server error');
        throw new UnavailableError('Search service error');
      }
      throw new DownstreamError('Search service returned an invalid response format');
    }
    throw new DownstreamError('Unexpected error from Search service');
  }
}
