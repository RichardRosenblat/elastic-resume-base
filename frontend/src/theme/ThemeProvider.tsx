/**
 * @file theme/ThemeProvider.tsx — Application theme context + MUI bridge.
 *
 * Provides three things to the component tree:
 *
 * 1. **`theme`** — the validated {@link AppTheme} read from `theme.json`.
 * 2. **`mode`** — the active colour-mode (`'light'` or `'dark'`).  Defaults
 *    to `theme.mode` but the user can override it via `toggleTheme()`.  The
 *    choice is persisted in `localStorage` under the key `appThemeMode`.
 * 3. **`toggleTheme()`** — flips the mode between light and dark.
 *
 * Additionally, this provider:
 * - Bridges the JSON theme into MUI's `createTheme` so all MUI components
 *   automatically pick up the custom palette.
 * - Injects CSS custom properties into `<html>` via {@link injectCssVariables}
 *   so non-MUI code can consume theme tokens.
 * - Applies `data-theme="dark"|"light"` to `<html>` for CSS selectors.
 *
 * @example
 * // In App.tsx
 * <AppThemeProvider>
 *   <YourApp />
 * </AppThemeProvider>
 *
 * // In a component
 * const { theme, mode, toggleTheme } = useAppTheme();
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import {
  ThemeProvider as MuiThemeProvider,
  createTheme,
} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { AppTheme } from './types';
import { AppThemeContext } from './app-theme-context';
import type { AppThemeContextValue } from './app-theme-context';
import { loadTheme } from './loadTheme';
import { injectCssVariables } from './toCssVariables';

// ---------------------------------------------------------------------------
// Load the static theme once at module initialisation time.
// This will throw loudly if theme.json is structurally invalid.
// ---------------------------------------------------------------------------
const appTheme: AppTheme = loadTheme();

const STORAGE_KEY = 'appThemeMode';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MUI bridge
// ---------------------------------------------------------------------------

/**
 * Creates a Material UI theme from the application's {@link AppTheme} and
 * the active colour-mode.
 *
 * @param theme - The application theme from `theme.json`.
 * @param mode  - The active colour-mode to pass to MUI.
 */
function buildMuiTheme(theme: AppTheme, mode: 'light' | 'dark') {
  const { palette, typography } = theme;

  return createTheme({
    palette: {
      mode,
      primary: {
        main: palette.primary.main,
        light: palette.primary.light,
        dark: palette.primary.dark,
        contrastText: palette.primary.contrastText,
      },
      secondary: {
        main: palette.secondary.main,
        light: palette.secondary.light,
        dark: palette.secondary.dark,
        contrastText: palette.secondary.contrastText,
      },
      success: { main: palette.success.main },
      warning: { main: palette.warning.main },
      error: { main: palette.error.main },
      info: { main: palette.info.main },
      background: {
        default: palette.background.default,
        paper: palette.background.paper,
      },
      text: {
        primary: palette.text.primary,
        secondary: palette.text.secondary,
      },
    },
    typography: {
      fontFamily: typography.fontFamily,
    },
  });
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

/** Props for the {@link AppThemeProvider} component. */
interface AppThemeProviderProps {
  children: ReactNode;
}

/**
 * Wraps the component tree with:
 * - The custom {@link AppThemeContext} (theme, mode, toggleTheme).
 * - MUI's `ThemeProvider` bridged from `theme.json`.
 * - MUI's `CssBaseline` for consistent baseline styles.
 * - CSS variable injection into `<html>`.
 */
export function AppThemeProvider({ children }: AppThemeProviderProps) {
  const [mode, setMode] = useState<'light' | 'dark'>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'light' || stored === 'dark') return stored;
    return appTheme.mode;
  });

  const toggleTheme = useCallback(() => {
    setMode((prev) => {
      const next = prev === 'light' ? 'dark' : 'light';
      localStorage.setItem(STORAGE_KEY, next);
      return next;
    });
  }, []);

  // Inject CSS variables and data-theme attribute whenever mode changes.
  useEffect(() => {
    injectCssVariables(appTheme);
    document.documentElement.setAttribute('data-theme', mode);
  }, [mode]);

  const muiTheme = useMemo(() => buildMuiTheme(appTheme, mode), [mode]);

  const contextValue = useMemo<AppThemeContextValue>(
    () => ({ theme: appTheme, mode, toggleTheme }),
    [mode, toggleTheme],
  );

  return (
    <AppThemeContext.Provider value={contextValue}>
      <MuiThemeProvider theme={muiTheme}>
        <CssBaseline />
        {children}
      </MuiThemeProvider>
    </AppThemeContext.Provider>
  );
}
