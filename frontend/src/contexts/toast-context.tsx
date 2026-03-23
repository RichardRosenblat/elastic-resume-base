import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ReactNode, SyntheticEvent } from 'react';
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

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [queue, setQueue] = useState<ToastItem[]>([]);
  const nextToastId = useRef(1);
  const closeTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const timers = closeTimers.current;
    return () => {
      timers.forEach((timerId) => clearTimeout(timerId));
      timers.clear();
    };
  }, []);

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

    const timeoutId = setTimeout(() => {
      closeTimers.current.delete(id);
      setQueue((prevQueue) => prevQueue.filter((toast) => toast.id !== id));
    }, durationMs);
    closeTimers.current.set(id, timeoutId);
  }, []);

  const handleClose = (toastId: number) => (_event?: SyntheticEvent | Event, reason?: string) => {
    if (reason === 'clickaway') {
      return;
    }
    const timeoutId = closeTimers.current.get(toastId);
    if (timeoutId) {
      clearTimeout(timeoutId);
      closeTimers.current.delete(toastId);
    }
    setQueue((prevQueue) => prevQueue.filter((toast) => toast.id !== toastId));
  };

  const contextValue: ToastContextType = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={contextValue}>
      {children}
      {queue.map((toast, index) => (
        <Snackbar
          key={toast.id}
          open
          autoHideDuration={toast.durationMs}
          onClose={handleClose(toast.id)}
          anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
          style={{ bottom: 24 + index * 72 }}
        >
          <Alert
            onClose={handleClose(toast.id)}
            severity={toast.severity}
            variant="filled"
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
              },
            }}
          >
            {toast.message}
          </Alert>
        </Snackbar>
      ))}
    </ToastContext.Provider>
  );
}
