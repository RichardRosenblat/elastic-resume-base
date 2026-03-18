import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess } from '@elastic-resume-base/bowltie';
import { search } from '../services/searchClient.js';

const searchSchema = z.object({
  query: z.string().min(1).max(1000),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(100).optional(),
  offset: z.number().int().min(0).optional(),
});

/** Handles POST /search - performs a semantic search. */
export async function searchHandler(request: FastifyRequest, reply: FastifyReply): Promise<void> {
  const body = searchSchema.parse(request.body);
  const result = await search(body);
  reply.send(formatSuccess(result, request.correlationId));
}
