import { createContext, useContext } from 'react';
import type { AppTheme } from './types';

/** Value exposed by AppThemeContext / consumed by useAppTheme. */
export interface AppThemeContextValue {
  /** The full validated application theme from theme.json. */
  theme: AppTheme;
  /** The currently active colour-mode. */
  mode: 'light' | 'dark';
  /** Toggles between light and dark and persists the choice. */
  toggleTheme: () => void;
}

export const AppThemeContext = createContext<AppThemeContextValue | null>(null);

/**
 * Returns the application theme context value. Must be called inside an
 * AppThemeProvider tree.
 */
export function useAppTheme(): AppThemeContextValue {
  const ctx = useContext(AppThemeContext);
  if (!ctx) {
    throw new Error('useAppTheme must be used within an AppThemeProvider');
  }
  return ctx;
}