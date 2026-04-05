import type { FastifyRequest, FastifyReply } from 'fastify';
import { logger } from '../utils/logger.js';

/** Responds with liveness status. */
export function getLive(_request: FastifyRequest, reply: FastifyReply): void {
  logger.trace('getLive: liveness probe received');
  void reply.send({ status: 'ok' });
}

/** Responds with readiness status. */
export function getReady(_request: FastifyRequest, reply: FastifyReply): void {
  logger.trace('getReady: readiness probe received');
  void reply.send({ status: 'ok' });
}
