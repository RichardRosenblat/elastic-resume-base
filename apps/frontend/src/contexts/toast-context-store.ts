import { createContext } from 'react';
import type { AlertColor } from '@mui/material';

export interface ToastContextType {
  showToast: (message: string, options?: {
    severity?: AlertColor;
    durationMs?: number;
    /** Optional technical details shown in a collapsible section. */
    detail?: string;
  }) => void;
}

export const ToastContext = createContext<ToastContextType | null>(null);