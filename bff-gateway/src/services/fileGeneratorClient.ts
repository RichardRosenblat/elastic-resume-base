import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
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
  logger.debug({ resumeId, format: payload.format, language: payload.language }, 'generateResume: forwarding request to file generator service');
  try {
    const response = await client.post<GenerateResponse>(`/resumes/${resumeId}/generate`, payload);
    logger.info({ resumeId, jobId: response.data.jobId, status: response.data.status }, 'generateResume: generation job accepted');
    return response.data;
  } catch (err) {
    const mapped = mapDownstreamError(err);
    logger.warn({ resumeId, code: mapped.code, statusCode: mapped.statusCode }, 'generateResume: downstream error from file generator service');
    throw new DownstreamError(mapped.message, mapped.statusCode, mapped.code);
  }
}
