import { useContext } from 'react';
import { ToastContext } from './toast-context-store.ts';
import type { ToastContextType } from './toast-context-store.ts';

export function useToast(): ToastContextType {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
}