import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { ensureApiRequestError, isRateLimitError } from '../services/api-error';
import { useToast } from '../contexts/use-toast';

/** Error code for user-input (misinput) validation failures. */
const MISINPUT_ERROR_CODE = 'VALIDATION_ERROR';

/**
 * Returns a stable `showApiError` function that shows an error toast for the
 * given error. Rate-limit errors (HTTP 429) are silently skipped here because
 * they are already handled globally by {@link useRateLimitNotifier}.
 *
 * For each error:
 * - The error is logged to the browser console to aid developer debugging,
 *   including the correlationId for tracing in server logs.
 * - The toast summary is a localized translation of the error code (when
 *   available), falling back to the raw API message and then to the
 *   `fallbackMessage`.
 * - When the error contains additional details (a raw server message that
 *   differs from the translated summary, or a correlationId), a collapsible
 *   "Show details" section is attached to the toast.
 * - For all errors except user-input (VALIDATION_ERROR) errors, the detail
 *   section always instructs the user to contact support.  When a correlationId
 *   is available it is included as a reference code for the support team.
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

      const fallback = fallbackMessage ?? t('common.error');
      const normalized = ensureApiRequestError(error, fallback);

      // Always log the full error details for developer debugging, including
      // the correlationId so it can be matched against server-side logs.
      console.error('[ApiRequestError]', {
        code: normalized.code,
        status: normalized.status,
        message: normalized.message,
        correlationId: normalized.correlationId,
      });

      // Build a localized summary for the toast headline.
      let summary = normalized.message || fallback;
      if (normalized.code) {
        const translationKey = `errors.${normalized.code}`;
        const translated = t(translationKey);
        // i18next returns the key itself when no translation is found.
        if (translated !== translationKey) {
          summary = translated;
        }
      }

      // Build an optional detail block shown in the expandable section.
      const detailParts: string[] = [];

      // Include the raw server message when it carries more context than the
      // translated summary (e.g. field-level validation failures).
      // Note: when no code translation exists, `summary` retains the raw server
      // message (`normalized.message || fallback`), so this guard correctly
      // skips adding a duplicate.
      if (normalized.message && normalized.message !== summary) {
        detailParts.push(normalized.message);
      }

      // For all errors except user-input (misinput) validation errors, always
      // instruct the user to contact support.  When a correlationId is present,
      // include it so the support team can trace the request in server logs.
      const isMisinputError = normalized.code === MISINPUT_ERROR_CODE;

      if (!isMisinputError) {
        if (normalized.correlationId) {
          detailParts.push(t('errors.serverSupportContact', { ref: normalized.correlationId }));
        } else {
          detailParts.push(t('errors.contactSupport'));
        }
      } else if (normalized.correlationId) {
        // Validation errors: only show the reference code, not a full support message.
        detailParts.push(t('errors.referenceCode', { ref: normalized.correlationId }));
      }

      const detail = detailParts.length > 0 ? detailParts.join('\n\n') : undefined;

      showToast(summary, { severity: 'error', detail });
    },
    [showToast, t],
  );
}
