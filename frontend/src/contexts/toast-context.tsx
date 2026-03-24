import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { Alert, Snackbar } from '@mui/material';
import { keyframes } from '@emotion/react';
import { ToastContext } from './toast-context-store.ts';
import type { ToastContextType } from './toast-context-store.ts';

const DEFAULT_TOAST_DURATION_MS = 5000;
const MIN_TOAST_DURATION_MS = 1000;
const MAX_TOAST_DURATION_MS = 15000;
const toastCountdown = keyframes`
  from {
    transform: scaleX(1);
  }
  to {
    transform: scaleX(0);
  }
`;

function getToastDurationMs(durationMs?: number): number {
  if (durationMs === undefined || Number.isNaN(durationMs)) {
    return DEFAULT_TOAST_DURATION_MS;
  }
  const safeDurationMs = Math.floor(durationMs);
  return Math.min(MAX_TOAST_DURATION_MS, Math.max(MIN_TOAST_DURATION_MS, safeDurationMs));
}

interface ToastItem {
  id: number;
  message: string;
  severity: 'error' | 'warning' | 'info' | 'success';
  durationMs: number;
}

interface ToastItemViewProps {
  toast: ToastItem;
  index: number;
  onClose: () => void;
}

/**
 * Renders a single toast notification.
 *
 * Manages its own countdown timer so that hovering over the toast pauses the
 * timer (and the progress-bar animation) and resumes it when the pointer leaves.
 */
function ToastItemView({ toast, index, onClose }: ToastItemViewProps) {
  const [isHovered, setIsHovered] = useState(false);

  // Keep onClose in a ref so the timer callback always calls the latest version
  // without needing to be restarted when the parent re-renders.
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Timestamp of when the current running timer was started
  const timerStartedAtRef = useRef<number>(0);
  // How many ms were remaining when the timer was last started/restarted
  const remainingMsRef = useRef<number>(toast.durationMs);

  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const startTimer = useCallback((delayMs: number) => {
    clearTimer();
    timerStartedAtRef.current = Date.now();
    remainingMsRef.current = delayMs;
    timerRef.current = setTimeout(() => {
      timerRef.current = null;
      onCloseRef.current();
    }, delayMs);
  }, [clearTimer]);

  // Start the auto-close timer once when the toast mounts.
  useEffect(() => {
    startTimer(toast.durationMs);
    return clearTimer;
  // startTimer and clearTimer are stable (useCallback with no changing deps).
  // We intentionally only run this on mount/unmount.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleMouseEnter = useCallback(() => {
    // Pause: calculate how much time is left and cancel the timer.
    const elapsed = Date.now() - timerStartedAtRef.current;
    remainingMsRef.current = Math.max(0, remainingMsRef.current - elapsed);
    clearTimer();
    setIsHovered(true);
  }, [clearTimer]);

  const handleMouseLeave = useCallback(() => {
    setIsHovered(false);
    // Resume: restart the timer with whatever time was left.
    startTimer(remainingMsRef.current);
  }, [startTimer]);

  return (
    <Snackbar
      open
      autoHideDuration={null}
      anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      style={{ bottom: 24 + index * 72 }}
    >
      <Alert
        onClose={() => onCloseRef.current()}
        severity={toast.severity}
        variant="filled"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        sx={{
          width: '100%',
          position: 'relative',
          overflow: 'hidden',
          '&::after': {
            content: '""',
            position: 'absolute',
            left: 0,
            bottom: 0,
            width: '100%',
            height: 3,
            backgroundColor: 'rgba(255, 255, 255, 0.8)',
            transformOrigin: 'left',
            animation: `${toastCountdown} ${toast.durationMs}ms linear forwards`,
            animationPlayState: isHovered ? 'paused' : 'running',
          },
        }}
      >
        {toast.message}
      </Alert>
    </Snackbar>
  );
}

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextToastId = useRef(1);

  const showToast: ToastContextType['showToast'] = useCallback((message, options) => {
    const id = nextToastId.current;
    nextToastId.current += 1;
    const durationMs = getToastDurationMs(options?.durationMs);

    setQueue((prevQueue) => prevQueue.concat({
      id,
      message,
      severity: options?.severity ?? 'error',
      durationMs,
    }));
  }, []);

  const handleClose = useCallback((toastId: number) => () => {
    setQueue((prevQueue) => prevQueue.filter((toast) => toast.id !== toastId));
  }, []);

  const contextValue: ToastContextType = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {queue.map((toast, index) => (
        <ToastItemView
          key={toast.id}
          toast={toast}
          index={index}
          onClose={handleClose(toast.id)}
        />
      ))}
    </ToastContext.Provider>
  );
}
