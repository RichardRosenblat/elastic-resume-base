import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fastify onRequest hook that attaches a correlation ID to each request.
 */
export function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const correlationId = (request.headers['x-correlation-id'] as string) || uuidv4();
  request.correlationId = correlationId;
  reply.header('x-correlation-id', correlationId);
  done();
}
