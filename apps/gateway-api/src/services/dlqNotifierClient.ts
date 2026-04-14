/**
 * @file dlqNotifierClient.ts — HTTP client for the DLQ Notifier service.
 *
 * Wraps the axios-based HTTP client to proxy notification requests to the
 * DLQ Notifier service, injecting user identity headers so the downstream
 * service can authorise and scope the response.
 */
import { isHarborError } from '@elastic-resume-base/harbor/server';
import { createHttpClient } from '../utils/httpClient.js';
import { config } from '../config.js';
import { logger } from '../utils/logger.js';
import { DownstreamError, UnavailableError } from '../errors.js';

const client = createHttpClient(config.dlqNotifierServiceUrl, 'dlqNotifier', config.dlqNotifierServiceTimeoutMs);

export interface NotificationRecord {
  id: string;
  category: 'user' | 'system';
  user_id: string | null;
  resume_id: string | null;
  service: string | null;
  stage: string | null;
  error_type: string | null;
  error: string | null;
  user_message: string | null;
  message_id: string;
  subscription: string;
  publish_time: string;
  created_at: string;
  read: boolean;
}

export interface NotificationListResponse {
  notifications: NotificationRecord[];
  total: number;
}

export interface NotificationQueryOptions {
  since?: string;
  limit?: number;
  service?: string;
  stage?: string;
  unread?: boolean;
}

/**
 * Returns user-letter notifications for the given user.
 *
 * @param userId  Firebase UID of the requesting user.
 * @param userRole  Role of the requesting user.
 * @param options  Optional query filters.
 */
export async function getUserNotifications(
  userId: string,
  userRole: string,
  options: NotificationQueryOptions = {},
): Promise<NotificationListResponse> {
  logger.debug({ userId }, 'dlqNotifierClient: fetching user notifications');
  const params: Record<string, string | number | boolean> = {};
  if (options.since) params['since'] = options.since;
  if (options.limit !== undefined) params['limit'] = options.limit;
  try {
    const response = await client.get<{ success: boolean; data: NotificationListResponse }>(
      '/api/v1/notifications',
      {
        params,
        headers: {
          'x-user-id': userId,
          'x-user-role': userRole,
        },
      },
    );
    return response.data.data;
  } catch (err) {
    if (isHarborError(err) && (!err.response || err.code === 'ECONNABORTED')) {
      throw new UnavailableError('DLQ Notifier service unavailable');
    }
    throw new DownstreamError('DLQ Notifier service error');
  }
}

/**
 * Returns system-letter notifications.  Admin-only.
 *
 * @param userId  Firebase UID of the requesting admin.
 * @param userRole  Role (must be 'admin').
 * @param options  Optional query filters.
 */
export async function getSystemNotifications(
  userId: string,
  userRole: string,
  options: NotificationQueryOptions = {},
): Promise<NotificationListResponse> {
  logger.debug({ userId }, 'dlqNotifierClient: fetching system notifications');
  const params: Record<string, string | number | boolean> = {};
  if (options.since) params['since'] = options.since;
  if (options.limit !== undefined) params['limit'] = options.limit;
  if (options.service) params['service'] = options.service;
  if (options.stage) params['stage'] = options.stage;
  if (options.unread !== undefined) params['unread'] = options.unread;
  try {
    const response = await client.get<{ success: boolean; data: NotificationListResponse }>(
      '/api/v1/notifications/system',
      {
        params,
        headers: {
          'x-user-id': userId,
          'x-user-role': userRole,
        },
      },
    );
    return response.data.data;
  } catch (err) {
    if (isHarborError(err) && (!err.response || err.code === 'ECONNABORTED')) {
      throw new UnavailableError('DLQ Notifier service unavailable');
    }
    throw new DownstreamError('DLQ Notifier service error');
  }
}

/**
 * Marks a notification as read.
 *
 * @param notificationId  Firestore document ID.
 * @param userId  Firebase UID of the requesting user.
 * @param userRole  Role of the requesting user.
 */
export async function markNotificationRead(
  notificationId: string,
  userId: string,
  userRole: string,
): Promise<void> {
  logger.debug({ notificationId, userId }, 'dlqNotifierClient: marking notification as read');
  try {
    await client.patch(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}/read`,
      {},
      {
        headers: {
          'x-user-id': userId,
          'x-user-role': userRole,
        },
      },
    );
  } catch (err) {
    if (isHarborError(err) && (!err.response || err.code === 'ECONNABORTED')) {
      throw new UnavailableError('DLQ Notifier service unavailable');
    }
    if (isHarborError(err) && err.response?.status === 404) {
      throw new DownstreamError('Notification not found');
    }
    throw new DownstreamError('DLQ Notifier service error');
  }
}

/**
 * Permanently deletes a notification.
 *
 * @param notificationId  Firestore document ID.
 * @param userId  Firebase UID of the requesting user.
 * @param userRole  Role of the requesting user.
 */
export async function deleteNotification(
  notificationId: string,
  userId: string,
  userRole: string,
): Promise<void> {
  logger.debug({ notificationId, userId }, 'dlqNotifierClient: deleting notification');
  try {
    await client.delete(
      `/api/v1/notifications/${encodeURIComponent(notificationId)}`,
      {
        headers: {
          'x-user-id': userId,
          'x-user-role': userRole,
        },
      },
    );
  } catch (err) {
    if (isHarborError(err) && (!err.response || err.code === 'ECONNABORTED')) {
      throw new UnavailableError('DLQ Notifier service unavailable');
    }
    if (isHarborError(err) && err.response?.status === 404) {
      throw new DownstreamError('Notification not found');
    }
    throw new DownstreamError('DLQ Notifier service error');
  }
}
