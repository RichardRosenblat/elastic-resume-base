import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRequestError } from '../services/api-error';
import { useToast } from '../contexts/use-toast';

const RATE_LIMIT_TOAST_DURATION_MS = 10_000;

/**
 * Registers a global listener for `api:ratelimit` events dispatched by the
 * Axios response interceptor whenever a 429 response is received.
 *
 * Shows a single warning-severity toast with the server-supplied message
 * (which includes the retry delay) so users get a clear, actionable notice
 * regardless of which page or component triggered the request.
 *
 * Mount this hook once near the application root (inside `ToastProvider`).
 */
export function useRateLimitNotifier(): void {
  const { showToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (event: Event) => {
      const apiError = (event as CustomEvent<ApiRequestError>).detail;
      const message = apiError?.correlationId
        ? `${apiError.message} (ref: ${apiError.correlationId})`
        : (apiError?.message ?? t('common.error'));
      showToast(message, { severity: 'warning', durationMs: RATE_LIMIT_TOAST_DURATION_MS });
    };

    window.addEventListener('api:ratelimit', handler);
    return () => {
      window.removeEventListener('api:ratelimit', handler);
    };
  }, [showToast, t]);
}
