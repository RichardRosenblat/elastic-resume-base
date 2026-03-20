import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import {
  getAllowlistEntry,
  upsertAllowlistEntry,
  deleteAllowlistEntry,
} from '../services/allowlistService.js';

// ---------------------------------------------------------------------------
// Validation schemas
// ---------------------------------------------------------------------------

const upsertAllowlistSchema = z.object({
  email: z.string().email(),
  role: z.string().optional(),
});

type EmailParams = { email: string };

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

/**
 * Handles GET /api/v1/allowlist/:email — retrieves a single allowlist entry.
 */
export async function getAllowlistEntryHandler(
  request: FastifyRequest<{ Params: EmailParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.params;
  logger.debug({ correlationId: request.correlationId, email }, 'getAllowlistEntryHandler: fetching entry');
  const entry = await getAllowlistEntry(email);
  logger.debug({ correlationId: request.correlationId, email }, 'getAllowlistEntryHandler: entry retrieved');
  void reply.send(formatSuccess(entry, request.correlationId));
}

/**
 * Handles POST /api/v1/allowlist — creates or updates an allowlist entry (idempotent upsert).
 */
export async function upsertAllowlistEntryHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  logger.debug({ correlationId: request.correlationId }, 'upsertAllowlistEntryHandler: validating request body');
  const parsed = upsertAllowlistSchema.safeParse(request.body);
  if (!parsed.success) {
    logger.warn(
      { correlationId: request.correlationId, issues: parsed.error.issues },
      'upsertAllowlistEntryHandler: validation failed',
    );
    void reply.code(400).send(
      formatError('VALIDATION_ERROR', parsed.error.issues[0]?.message ?? 'Validation error', request.correlationId),
    );
    return;
  }
  logger.info({ correlationId: request.correlationId, email: parsed.data.email }, 'upsertAllowlistEntryHandler: upserting entry');
  const entry = await upsertAllowlistEntry(parsed.data.email, parsed.data.role);
  logger.debug({ correlationId: request.correlationId, email: parsed.data.email }, 'upsertAllowlistEntryHandler: entry upserted');
  void reply.code(200).send(formatSuccess(entry, request.correlationId));
}

/**
 * Handles DELETE /api/v1/allowlist/:email — removes an allowlist entry.
 */
export async function deleteAllowlistEntryHandler(
  request: FastifyRequest<{ Params: EmailParams }>,
  reply: FastifyReply,
): Promise<void> {
  const { email } = request.params;
  logger.info({ correlationId: request.correlationId, email }, 'deleteAllowlistEntryHandler: deleting entry');
  await deleteAllowlistEntry(email);
  logger.debug({ correlationId: request.correlationId, email }, 'deleteAllowlistEntryHandler: entry deleted');
  void reply.code(204).send();
}
