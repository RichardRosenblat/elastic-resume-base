/**
 * @file notifications.controller.ts — Handlers for the Notifications API.
 *
 * Proxies notification requests to the DLQ Notifier service, injecting the
 * authenticated user's identity as `x-user-id` and `x-user-role` headers.
 */
import type { FastifyRequest, FastifyReply } from 'fastify';
import { z } from 'zod';
import { formatSuccess, formatError } from '@elastic-resume-base/bowltie';
import { logger } from '../utils/logger.js';
import {
  getUserNotifications,
  getSystemNotifications,
  markNotificationRead,
  deleteNotification,
} from '../services/dlqNotifierClient.js';
import { UnavailableError } from '../errors.js';

const listQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
});

const systemListQuerySchema = z.object({
  since: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  service: z.string().optional(),
  stage: z.string().optional(),
  unread: z.enum(['true', 'false']).optional().transform((v) => v === undefined ? undefined : v === 'true'),
});

const notificationIdSchema = z.object({
  notificationId: z.string().min(1),
});

/** Handles GET /api/v1/notifications — returns user notifications. */
export async function listNotificationsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const parsed = listQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'Invalid query parameters'));
    return;
  }
  const { uid, role } = request.user;
  logger.debug({ correlationId: request.correlationId, uid }, 'listNotificationsHandler: fetching notifications');
  try {
    const result = await getUserNotifications(uid, role ?? 'user', {
      since: parsed.data.since,
      limit: parsed.data.limit,
    });
    void reply.send(formatSuccess(result, request.correlationId));
  } catch (err) {
    if (err instanceof UnavailableError) {
      void reply.code(503).send(formatError('SERVICE_UNAVAILABLE', 'Notification service temporarily unavailable'));
      return;
    }
    throw err;
  }
}

/** Handles GET /api/v1/notifications/system — admin-only system notifications. */
export async function listSystemNotificationsHandler(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  const { uid, role } = request.user;
  if (role !== 'admin') {
    void reply.code(403).send(formatError('FORBIDDEN', 'System notifications are accessible to admins only'));
    return;
  }
  const parsed = systemListQuerySchema.safeParse(request.query);
  if (!parsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'Invalid query parameters'));
    return;
  }
  logger.debug({ correlationId: request.correlationId, uid }, 'listSystemNotificationsHandler: fetching system notifications');
  try {
    const result = await getSystemNotifications(uid, role, {
      since: parsed.data.since,
      limit: parsed.data.limit,
      service: parsed.data.service,
      stage: parsed.data.stage,
      unread: parsed.data.unread,
    });
    void reply.send(formatSuccess(result, request.correlationId));
  } catch (err) {
    if (err instanceof UnavailableError) {
      void reply.code(503).send(formatError('SERVICE_UNAVAILABLE', 'Notification service temporarily unavailable'));
      return;
    }
    throw err;
  }
}

/** Handles PATCH /api/v1/notifications/:notificationId/read */
export async function markReadHandler(
  request: FastifyRequest<{ Params: { notificationId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const paramsParsed = notificationIdSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'Invalid notificationId'));
    return;
  }
  const { uid, role } = request.user;
  const { notificationId } = paramsParsed.data;
  logger.debug({ correlationId: request.correlationId, uid, notificationId }, 'markReadHandler: marking notification as read');
  try {
    await markNotificationRead(notificationId, uid, role ?? 'user');
    void reply.send(formatSuccess({ id: notificationId, read: true }, request.correlationId));
  } catch (err) {
    if (err instanceof UnavailableError) {
      void reply.code(503).send(formatError('SERVICE_UNAVAILABLE', 'Notification service temporarily unavailable'));
      return;
    }
    throw err;
  }
}

/** Handles DELETE /api/v1/notifications/:notificationId */
export async function deleteNotificationHandler(
  request: FastifyRequest<{ Params: { notificationId: string } }>,
  reply: FastifyReply,
): Promise<void> {
  const paramsParsed = notificationIdSchema.safeParse(request.params);
  if (!paramsParsed.success) {
    void reply.code(400).send(formatError('VALIDATION_ERROR', 'Invalid notificationId'));
    return;
  }
  const { uid, role } = request.user;
  const { notificationId } = paramsParsed.data;
  logger.info({ correlationId: request.correlationId, uid, notificationId }, 'deleteNotificationHandler: deleting notification');
  try {
    await deleteNotification(notificationId, uid, role ?? 'user');
    void reply.code(204).send();
  } catch (err) {
    if (err instanceof UnavailableError) {
      void reply.code(503).send(formatError('SERVICE_UNAVAILABLE', 'Notification service temporarily unavailable'));
      return;
    }
    throw err;
  }
}
