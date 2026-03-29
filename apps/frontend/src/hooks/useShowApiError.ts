import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { isRateLimitError, toUserFacingErrorMessage } from '../services/api-error';
import { useToast } from '../contexts/use-toast';

/**
 * Returns a stable `showApiError` function that shows an error toast for the
 * given error. Rate-limit errors (HTTP 429) are silently skipped here because
 * they are already handled globally by {@link useRateLimitNotifier}.
 *
 * @example
 * ```typescript
 * const showApiError = useShowApiError();
 * try {
 *   await someApiCall();
 * } catch (error) {
 *   showApiError(error, t('common.error'));
 * }
 * ```
 */
export function useShowApiError(): (error: unknown, fallbackMessage?: string) => void {
  const { showToast } = useToast();
  const { t } = useTranslation();

  return useCallback(
    (error: unknown, fallbackMessage?: string) => {
      // Rate-limit errors are displayed by the global RateLimitNotifier;
      // skip showing a duplicate toast here.
      if (isRateLimitError(error)) return;
      const message = toUserFacingErrorMessage(error, fallbackMessage ?? t('common.error'));
      showToast(message, { severity: 'error' });
    },
    [showToast, t],
  );
}
