import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { GenerateRequest, GenerateResponse } from '../models/index.js';
import { mapDownstreamError } from '../utils/errorMapper.js';
import { DownstreamError } from '../errors.js';

const client = createHttpClient(config.fileGeneratorServiceUrl);

/**
 * Triggers resume file generation via the file generator service.
 * @param resumeId - The ID of the resume to generate.
 * @param payload - Generation parameters.
 * @returns GenerateResponse with job details.
 */
export async function generateResume(resumeId: string, payload: GenerateRequest): Promise<GenerateResponse> {
  try {
    const response = await client.post<GenerateResponse>(`/resumes/${resumeId}/generate`, payload);
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
