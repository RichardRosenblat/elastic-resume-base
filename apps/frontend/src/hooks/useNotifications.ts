/**
 * @file useNotifications.ts — Smart-polling hook for DLQ notifications.
 *
 * Fetches the calling user's notifications (and system notifications for
 * admins) from the Gateway API, using an adaptive polling interval that
 * speeds up when the user is actively engaging with the notification panel
 * and slows down during idle periods.
 *
 * The service availability banner is surfaced via a `serviceUnavailable`
 * flag so that the UI can warn users when the DLQ Notifier is down.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { config } from '../config';
import { getNotifications, getSystemNotifications, markNotificationRead, deleteNotification } from '../services/api';
import type { NotificationRecord } from '../types';
import { useAuth } from '../contexts/auth-context';
import { useFeatureFlags } from './useFeatureFlags';

const { activeIntervalMs, idleIntervalMs, idleThresholdMs } = config.notifications;

export interface UseNotificationsReturn {
  /** All notifications for the current user. */
  notifications: NotificationRecord[];
  /** System notifications (populated for admins only). */
  systemNotifications: NotificationRecord[];
  /** Total number of unread user notifications. */
  unreadCount: number;
  /** Total number of unread system notifications (admins). */
  unreadSystemCount: number;
  /** Whether the notification service is currently unreachable. */
  serviceUnavailable: boolean;
  /** Whether the initial load is still in progress. */
  loading: boolean;
  /** Force an immediate re-fetch and reset the polling clock. */
  refresh: () => void;
  /** Mark a single notification as read. */
  markRead: (id: string) => Promise<void>;
  /** Delete a single notification. */
  remove: (id: string) => Promise<void>;
}

/**
 * Smart-polling hook that manages DLQ notifications for the authenticated user.
 *
 * Polling behaviour:
 * - Starts at `activeIntervalMs` (default 30 s).
 * - Slows to `idleIntervalMs` (default 120 s) after `idleThresholdMs` of inactivity.
 * - Immediately jumps back to `activeIntervalMs` when the user calls `refresh()`.
 * - Fetches only notifications newer than the last-seen timestamp to minimise bandwidth.
 * - Caps the server-side look-back to 24 hours (enforced by the backend).
 *
 * Handles the DLQ Notifier being unavailable gracefully:
 * - Sets `serviceUnavailable = true` on network errors (503 / ECONNREFUSED).
 * - Does **not** crash or throw — the rest of the frontend remains fully functional.
 *
 * @returns A {@link UseNotificationsReturn} object with notification state and actions.
 */
export function useNotifications(): UseNotificationsReturn {
  const { isAdmin } = useAuth();
  const features = useFeatureFlags();

  const [notifications, setNotifications] = useState<NotificationRecord[]>([]);
  const [systemNotifications, setSystemNotifications] = useState<NotificationRecord[]>([]);
  const [serviceUnavailable, setServiceUnavailable] = useState(false);
  const [loading, setLoading] = useState(true);

  // Track last-checked timestamp to support incremental polling.
  const lastCheckedRef = useRef<string | undefined>(undefined);
  const lastInteractionRef = useRef<number>(Date.now());
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const unreadCount = notifications.filter((n) => !n.read).length;
  const unreadSystemCount = systemNotifications.filter((n) => !n.read).length;

  const fetchNotifications = useCallback(async () => {
    if (!features.dlqNotifier) {
      setLoading(false);
      return;
    }
    try {
      const [userResult, systemResult] = await Promise.all([
        getNotifications(lastCheckedRef.current),
        isAdmin ? getSystemNotifications({ since: lastCheckedRef.current }) : Promise.resolve(null),
      ]);

      // Merge incremental results with existing state (dedup by id, update read status).
      setNotifications((prev) => {
        const map = new Map(prev.map((n) => [n.id, n]));
        for (const n of userResult.notifications) {
          map.set(n.id, n);
        }
        return Array.from(map.values()).sort(
          (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
      });

      if (systemResult) {
        setSystemNotifications((prev) => {
          const map = new Map(prev.map((n) => [n.id, n]));
          for (const n of systemResult.notifications) {
            map.set(n.id, n);
          }
          return Array.from(map.values()).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
          );
        });
      }

      // Advance the since cursor to now so the next poll only fetches newer items.
      lastCheckedRef.current = new Date().toISOString();
      setServiceUnavailable(false);
    } catch {
      // If the service is unavailable, flag it and keep the existing notifications.
      setServiceUnavailable(true);
    } finally {
      setLoading(false);
    }
  }, [features.dlqNotifier, isAdmin]);

  const scheduleNext = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    const idleFor = Date.now() - lastInteractionRef.current;
    const interval = idleFor > idleThresholdMs ? idleIntervalMs : activeIntervalMs;
    timerRef.current = setTimeout(() => {
      void fetchNotifications().then(scheduleNext);
    }, interval);
  }, [fetchNotifications]);

  const refresh = useCallback(() => {
    // Record the interaction and reset the poll clock.
    lastInteractionRef.current = Date.now();
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
    }
    setLoading(true);
    void fetchNotifications().then(scheduleNext);
  }, [fetchNotifications, scheduleNext]);

  // Initial fetch + start polling on mount.
  useEffect(() => {
    if (!features.dlqNotifier) {
      setLoading(false);
      return;
    }
    void fetchNotifications().then(scheduleNext);
    return () => {
      if (timerRef.current !== null) {
        clearTimeout(timerRef.current);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [features.dlqNotifier]);

  const markRead = useCallback(async (id: string) => {
    lastInteractionRef.current = Date.now();
    try {
      await markNotificationRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
      setSystemNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      );
    } catch {
      // Best-effort — ignore mark-read failures silently
    }
  }, []);

  const remove = useCallback(async (id: string) => {
    lastInteractionRef.current = Date.now();
    try {
      await deleteNotification(id);
      setNotifications((prev) => prev.filter((n) => n.id !== id));
      setSystemNotifications((prev) => prev.filter((n) => n.id !== id));
    } catch {
      // Best-effort — ignore delete failures silently
    }
  }, []);

  return {
    notifications,
    systemNotifications,
    unreadCount,
    unreadSystemCount,
    serviceUnavailable,
    loading,
    refresh,
    markRead,
    remove,
  };
}
