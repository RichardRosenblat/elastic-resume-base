import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { DocumentReadRequest, DocumentReadResponse } from '../models/index.js';
import { mapDownstreamError } from '../utils/errorMapper.js';
import { DownstreamError } from '../errors.js';

const client = createHttpClient(config.documentReaderServiceUrl);

/**
 * Reads and extracts text from a document via the document reader service.
 * @param payload - Document read request payload.
 * @returns DocumentReadResponse with extracted text.
 */
export async function readDocument(payload: DocumentReadRequest): Promise<DocumentReadResponse> {
  try {
    const response = await client.post<DocumentReadResponse>('/read', payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
