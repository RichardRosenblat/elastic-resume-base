import { createHttpClient } from '../utils/httpClient';
import { config } from '../config';
import { GenerateRequest, GenerateResponse } from '../types';
import { mapDownstreamError } from '../utils/errorMapper';

const client = createHttpClient(config.fileGeneratorServiceUrl);

export async function generateResume(resumeId: string, payload: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await client.post<GenerateResponse>(`/resumes/${resumeId}/generate`, payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw Object.assign(new Error(mapped.message), { statusCode: mapped.statusCode, code: mapped.code });
  }
}
