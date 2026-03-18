import type { FastifyRequest, FastifyReply, HookHandlerDoneFunction } from 'fastify';
import { v4 as uuidv4 } from 'uuid';

/**
 * Fastify onRequest hook that attaches a correlation ID to each request.
 * Uses the incoming `x-correlation-id` header or generates a new UUID.
 */
export function correlationIdHook(
  request: FastifyRequest,
  reply: FastifyReply,
  done: HookHandlerDoneFunction,
): void {
  const correlationId = (request.headers['x-correlation-id'] as string) || uuidv4();
  request.correlationId = correlationId;
  void reply.header('x-correlation-id', correlationId);
  done();
}
