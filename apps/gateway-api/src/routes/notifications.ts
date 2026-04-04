/**
 * @file notifications.ts — Notification API routes for the Gateway API.
 *
 * Proxies notification requests to the DLQ Notifier service after the
 * authentication middleware has verified the Firebase ID token.  The
 * authenticated user's UID and role are injected as downstream headers.
 */
import type { FastifyPluginAsync } from 'fastify';
import {
  listNotificationsHandler,
  listSystemNotificationsHandler,
  markReadHandler,
  deleteNotificationHandler,
} from '../controllers/notifications.controller.js';

const notificationsPlugin: FastifyPluginAsync = async (app) => {
  /** GET /api/v1/notifications — user notifications */
  app.get('/', {
    schema: {
      tags: ['Notifications'],
      summary: 'List the calling user\'s DLQ notifications',
      description:
        'Returns user-letter DLQ failure notifications addressed to the authenticated user. ' +
        'Supports incremental polling via the `since` query parameter (ISO-8601). ' +
        'Results are capped to the last 24 hours.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', format: 'date-time', description: 'Return only notifications after this timestamp' },
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Maximum number of results', default: 50 },
        },
      },
    },
  }, listNotificationsHandler);

  /** GET /api/v1/notifications/system — system notifications (admin only) */
  app.get('/system', {
    schema: {
      tags: ['Notifications'],
      summary: 'List system DLQ notifications (admin only)',
      description:
        'Returns system-level DLQ failure notifications for administrators. ' +
        'Supports filtering by `service`, `stage`, and `unread` status.',
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          since: { type: 'string', format: 'date-time', description: 'Return only notifications after this timestamp' },
          limit: { type: 'integer', minimum: 1, maximum: 200, description: 'Maximum number of results', default: 50 },
          service: { type: 'string', description: 'Filter by originating service' },
          stage: { type: 'string', description: 'Filter by pipeline stage' },
          unread: { type: 'boolean', description: 'When true, return only unread notifications' },
        },
      },
    },
  }, listSystemNotificationsHandler);

  /** PATCH /api/v1/notifications/:notificationId/read */
  app.patch('/:notificationId/read', {
    schema: {
      tags: ['Notifications'],
      summary: 'Mark a notification as read',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['notificationId'],
        properties: {
          notificationId: { type: 'string', description: 'Firestore document ID of the notification' },
        },
      },
    },
  }, markReadHandler);

  /** DELETE /api/v1/notifications/:notificationId */
  app.delete('/:notificationId', {
    schema: {
      tags: ['Notifications'],
      summary: 'Delete a notification',
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['notificationId'],
        properties: {
          notificationId: { type: 'string', description: 'Firestore document ID of the notification' },
        },
      },
    },
  }, deleteNotificationHandler);
};

export default notificationsPlugin;
