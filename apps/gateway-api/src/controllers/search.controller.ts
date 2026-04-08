import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { search } from '../services/searchClient.js';

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.record(z.string(), z.unknown()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/** Handles POST /search - performs a semantic search. */
export async function searchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'searchHandler: validating request body');
  const body = searchSchema.parse(request.body);
  logger.info({ correlationId: request.correlationId, queryLength: body.query.length, limit: body.limit }, 'searchHandler: executing search');
  const result = await search(body);
  logger.debug({ correlationId: request.correlationId, resultCount: result.results?.length }, 'searchHandler: search completed');
  void reply.send(formatSuccess(result, request.correlationId));
}
