import type { FastifyRequest, FastifyReply } from 'fastify';
import { ZodError } from 'zod';
import { formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import { AppError } from '../errors.js';
import { reportError } from '../utils/cloudErrorReporting.js';

/** Logs and sends a structured error response, reporting 5xx errors to Cloud Error Reporting. */
function sendError(
  reply: FastifyReply,
  statusCode: number,
  code: string,
  message: string,
  correlationId: string,
  originalErr: Error,
  logContext: Record<string, unknown>,
): void {
  if (statusCode === 500) {
    logger.error({ ...logContext, correlationId }, 'Unhandled error');
    reportError(originalErr);
  } else {
    logger.warn({ ...logContext, correlationId }, 'Downstream service error');
  }
  void reply.code(statusCode).send(formatError(code, message, correlationId));
}

/**
 * Fastify error handler.
 * Handles ZodError, AppError, generic Error, and unknown errors.
 */
export function errorHandler(err: Error, request: FastifyRequest, reply: FastifyReply): void {
  const correlationId = request.correlationId;

  if (err instanceof ZodError) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'Request validation failed', correlationId));
    return;
  }

  if (err instanceof AppError) {
    sendError(
      reply,
      err.statusCode,
      err.code,
      err.statusCode === 500 ? 'An unexpected error occurred' : err.message,
      correlationId,
      err,
      { message: err.message, code: err.code, statusCode: err.statusCode },
    );
    return;
  }

  const appError = err as Error & { statusCode?: number; code?: string };
  const statusCode = appError.statusCode ?? 500;
  sendError(
    reply,
    statusCode,
    appError.code ?? 'INTERNAL_ERROR',
    statusCode === 500 ? 'An unexpected error occurred' : err.message,
    correlationId,
    err,
    { message: err.message, code: appError.code, statusCode },
  );
}
