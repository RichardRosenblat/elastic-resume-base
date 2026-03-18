import type { FastifyRequest, FastifyReply } from 'fastify';

/** Responds with liveness status. */
export function getLive(_request: FastifyRequest, reply: FastifyReply): void {
  reply.send({ status: 'ok' });
}

/** Responds with readiness status. */
export function getReady(_request: FastifyRequest, reply: FastifyReply): void {
  reply.send({ status: 'ok' });
}
