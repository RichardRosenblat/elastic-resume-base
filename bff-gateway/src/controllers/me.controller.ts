import { formatSuccess } from '@elastic-resume-base/bowltie';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { logger } from '../utils/logger.js';

/** Returns the authenticated user's profile. */
export function getProfile(request: FastifyRequest, reply: FastifyReply): void {
  const { uid, email, name, picture, role, enable } = request.user;
  logger.debug({ correlationId: request.correlationId, uid }, 'getProfile: returning authenticated user profile');
  void reply.send(formatSuccess({ uid, email, name, picture, role, enable }, request.correlationId));
}
