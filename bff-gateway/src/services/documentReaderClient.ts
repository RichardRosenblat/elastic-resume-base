import { createHttpClient } from '../utils/httpClient';
import { config } from '../config';
import { DocumentReadRequest, DocumentReadResponse } from '../types';
import { mapDownstreamError } from '../utils/errorMapper';

const client = createHttpClient(config.documentReaderServiceUrl);

export async function readDocument(payload: DocumentReadRequest): Promise<DocumentReadResponse> {
  try {
    const response = await client.post<DocumentReadResponse>('/read', payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw Object.assign(new Error(mapped.message), { statusCode: mapped.statusCode, code: mapped.code });
  }
}
