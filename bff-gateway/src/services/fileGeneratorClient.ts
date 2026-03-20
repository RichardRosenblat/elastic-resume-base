import axios from 'axios';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { GenerateRequest, GenerateResponse } from '../models/index.js';
import { DownstreamError, UnavailableError } from '../errors.js';

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
    if (axios.isAxiosError(err)) {
      if (err.code === 'ECONNABORTED' || err.code === 'ETIMEDOUT' || !err.response) {
        logger.warn({ resumeId }, 'generateResume: file generator service unavailable');
        throw new UnavailableError('FileGenerator service unavailable');
      }
      if (err.response.status >= 500) {
        logger.warn({ resumeId, status: err.response.status }, 'generateResume: file generator service server error');
        throw new UnavailableError('FileGenerator service error');
      }
      throw new DownstreamError('FileGenerator service returned unexpected response');
    }
    throw new DownstreamError('Unexpected error from FileGenerator service');
  }
}
