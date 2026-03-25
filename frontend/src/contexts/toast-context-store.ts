import { createContext } from 'react';
import type { AlertColor } from '@mui/material';

export interface ToastContextType {
  showToast: (message: string, options?: { severity?: AlertColor; durationMs?: number }) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);