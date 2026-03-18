import type { FastifyRequest, FastifyReply } from 'fastify';
import { formatSuccess } from '@elastic-resume-base/bowltie';

/** Returns the authenticated user's profile. */
export function getProfile(request: FastifyRequest, reply: FastifyReply): void {
  const { uid, email, name, picture } = request.user;
  void reply.send(formatSuccess({ uid, email, name, picture }, request.correlationId));
}
