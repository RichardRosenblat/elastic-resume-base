import type { FastifyRequest, FastifyReply } from 'fastify';
import { formatSuccess } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';

/** Returns the authenticated user's profile. */
export function getProfile(request: FastifyRequest, reply: FastifyReply): void {
  const { uid, email, name, picture } = request.user;
  logger.debug({ correlationId: request.correlationId, uid }, 'getProfile: returning authenticated user profile');
  void reply.send(formatSuccess({ uid, email, name, picture }, request.correlationId));
}
