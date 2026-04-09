import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import type { ApiRequestError } from '../services/api-error';
import { useToast } from '../contexts/use-toast';

/**
 * Registers a global listener for `api:account-disabled` events dispatched by
 * the Axios response interceptor whenever a 403 response with a "disabled"
 * account message is received.
 *
 * Shows an error toast so the user gets a clear, actionable notice that their
 * account has been disabled, regardless of which page or component triggered
 * the request. The Axios interceptor also calls `auth.signOut()` so the user
 * is redirected to the login page after the toast appears.
 *
 * Mount this hook once near the application root (inside `ToastProvider`).
 */
export function useAccountStatusNotifier(): void {
  const { showToast } = useToast();
  const { t } = useTranslation();

  useEffect(() => {
    const handler = (event: Event) => {
      const apiError = (event as CustomEvent<ApiRequestError>).detail;
      const message = t('errors.USER_DISABLED');
      const localizedMessage = apiError?.correlationId
        ? `${message} (ref: ${apiError.correlationId})`
        : message;
      showToast(localizedMessage, { severity: 'error' });
    };

    window.addEventListener('api:account-disabled', handler);
    return () => {
      window.removeEventListener('api:account-disabled', handler);
    };
  }, [showToast, t]);
}
