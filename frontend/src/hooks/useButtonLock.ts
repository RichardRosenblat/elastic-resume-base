/**
 * @file useButtonLock.ts — Hook that wraps an async handler with a minimum
 * lock delay to prevent request spamming.
 *
 * ## Behaviour
 *
 * - The returned `locked` state is `true` from the moment the wrapped handler
 *   is invoked until **at least** `delayMs` milliseconds have elapsed.
 * - If the wrapped handler takes longer than `delayMs`, the lock releases
 *   immediately after the handler resolves/rejects (no extra delay stacked on
 *   top of the operation time).
 * - While `locked === true`, subsequent calls to the wrapped handler are
 *   silently ignored (no-op).
 *
 * ## Usage
 *
 * ```tsx
 * const { locked, wrap } = useButtonLock(500);
 *
 * <Button
 *   disabled={locked || !inputValue}
 *   onClick={wrap(handleSearch)}
 * >
 *   Search
 * </Button>
 * ```
 *
 * For multiple independent buttons in the same component, call the hook once
 * per button:
 *
 * ```tsx
 * const { locked: saveLocked, wrap: wrapSave } = useButtonLock();
 * const { locked: deleteLocked, wrap: wrapDelete } = useButtonLock();
 * ```
 */
import { useState, useCallback, useRef, useEffect } from 'react';

export interface UseButtonLockReturn {
  /** `true` while the wrapped handler is executing or during the lock delay. */
  locked: boolean;
  /**
   * Returns a new async function that:
   * 1. Ignores the call if currently locked.
   * 2. Locks the button immediately.
   * 3. Awaits `fn`.
   * 4. Releases the lock after `Math.max(0, delayMs - elapsed)` ms so the
   *    total locked time is at least `delayMs`.
   */
  wrap: (fn: () => void | Promise<void>) => () => Promise<void>;
}

/**
 * Wraps an async action with a minimum-duration lock to prevent duplicate
 * requests when users click rapidly.
 *
 * @param delayMs - Minimum time (ms) the button stays locked after a click.
 *   Defaults to `500`.
 */
export function useButtonLock(delayMs = 500): UseButtonLockReturn {
  const [locked, setLocked] = useState(false);
  const lockedRef = useRef(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current !== null) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, []);

  const wrap = useCallback(
    (fn: () => void | Promise<void>) =>
      async (): Promise<void> => {
        if (lockedRef.current) return;
        lockedRef.current = true;
        setLocked(true);
        const startTime = Date.now();
        try {
          await fn();
        } finally {
          const elapsed = Date.now() - startTime;
          const remaining = Math.max(0, delayMs - elapsed);
          if (timeoutRef.current !== null) {
            clearTimeout(timeoutRef.current);
          }
          timeoutRef.current = setTimeout(() => {
            lockedRef.current = false;
            setLocked(false);
            timeoutRef.current = null;
          }, remaining);
        }
      },
    [delayMs],
  );

  return { locked, wrap };
}
