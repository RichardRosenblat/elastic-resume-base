/**
 * @file theme/ThemeProvider.tsx — Application theme context + MUI bridge.
 *
 * Provides three things to the component tree:
 *
 * 1. **`theme`** — the validated {@link AppTheme} loaded from
 *    `theme.local.json` when available, otherwise `theme.json`.
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
  alpha,
} from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import type { AppTheme, AlertPalette } from './types';
import { AppThemeContext } from './app-theme-context';
import type { AppThemeContextValue } from './app-theme-context';
import { loadTheme } from './loadTheme';
import { injectCssVariables } from './toCssVariables';

// ---------------------------------------------------------------------------
// Load the selected theme once at module initialisation time.
// This will throw loudly if the chosen theme file is structurally invalid.
// ---------------------------------------------------------------------------
const appTheme: AppTheme = loadTheme();

const STORAGE_KEY = 'appThemeMode';

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// MUI bridge
// ---------------------------------------------------------------------------

type AlertStyleOverrides = Record<string, Record<string, string | Record<string, string>>>;

/**
 * Builds MUI Alert component style overrides from an {@link AlertPalette}.
 *
 * Each defined tone property is applied individually so that omitted
 * properties do not override MUI's automatic derivation.
 *
 * @param alerts - The optional alert palette from `theme.json`.
 * @returns A partial MUI `MuiAlert` style-overrides object.
 */
function buildAlertStyleOverrides(alerts: AlertPalette | undefined): AlertStyleOverrides {
  const overrides: AlertStyleOverrides = {};
  const severitySlots = {
    success: { standard: 'standardSuccess', filled: 'filledSuccess' },
    warning: { standard: 'standardWarning', filled: 'filledWarning' },
    error: { standard: 'standardError', filled: 'filledError' },
    info: { standard: 'standardInfo', filled: 'filledInfo' },
  } as const;

  for (const [severity, slots] of Object.entries(severitySlots) as [
    keyof typeof severitySlots,
    { standard: string; filled: string },
  ][]) {
    const tone = alerts?.[severity];
    if (!tone) continue;

    if (tone.bg !== undefined || tone.color !== undefined) {
      const standardStyle: Record<string, string | Record<string, string>> = {};
      if (tone.bg !== undefined) standardStyle['backgroundColor'] = tone.bg;
      if (tone.color !== undefined) {
        standardStyle['color'] = tone.color;
        standardStyle['& .MuiAlert-icon'] = { color: tone.color };
      }
      overrides[slots.standard] = standardStyle;
    }

    if (tone.filledBg !== undefined || tone.filledColor !== undefined) {
      const filledStyle: Record<string, string> = {};
      if (tone.filledBg !== undefined) filledStyle['backgroundColor'] = tone.filledBg;
      if (tone.filledColor !== undefined) filledStyle['color'] = tone.filledColor;
      overrides[slots.filled] = filledStyle;
    }
  }

  return overrides;
}

/**
 * Creates a Material UI theme from the application's {@link AppTheme} and
 * the active colour-mode.
 *
 * @param theme - The application theme from `theme.json`.
 * @param mode  - The active colour-mode to pass to MUI.
 */
function buildMuiTheme(theme: AppTheme, mode: 'light' | 'dark') {
  const { palette, typography } = theme;
  const surfaceBorder = palette.ui?.border ?? (mode === 'dark'
    ? alpha(palette.text.primary, 0.1)
    : alpha(palette.text.primary, 0.08));
  const dividerColor = palette.ui?.divider ?? alpha(palette.text.primary, 0.12);
  const inputBackground = palette.background.input ?? (mode === 'dark'
    ? alpha(palette.background.paper, 0.88)
    : alpha(palette.background.paper, 0.65));
  const disabledBackground = palette.ui?.disabledBackground ?? (mode === 'dark'
    ? alpha(palette.text.primary, 0.08)
    : alpha(palette.text.primary, 0.06));
  const disabledText = palette.ui?.disabledText ?? alpha(palette.text.primary, 0.55);
  const focusRing = palette.ui?.focusRing ?? alpha(palette.primary.main, 0.8);
  const chipBackground = {
    success: palette.badge?.success?.bg ?? alpha(palette.success.main, 0.18),
    warning: palette.badge?.warning?.bg ?? alpha(palette.warning.main, 0.2),
    primary: palette.badge?.primary?.bg ?? alpha(palette.primary.main, 0.18),
    default: palette.badge?.default?.bg ?? alpha(palette.text.secondary, 0.2),
  };
  const chipText = {
    success: palette.badge?.success?.text ?? (mode === 'dark' ? '#9AE6B4' : '#1F6F4A'),
    warning: palette.badge?.warning?.text ?? (mode === 'dark' ? '#F8D287' : '#7A5310'),
    primary: palette.badge?.primary?.text ?? (mode === 'dark' ? '#A9D3FF' : '#144D9A'),
    default: palette.badge?.default?.text ?? palette.text.secondary,
  };
  const chipBorder = {
    success: palette.badge?.success?.border ?? alpha(palette.success.main, 0.36),
    warning: palette.badge?.warning?.border ?? alpha(palette.warning.main, 0.36),
    primary: palette.badge?.primary?.border ?? alpha(palette.primary.main, 0.36),
    default: palette.badge?.default?.border ?? alpha(palette.text.secondary, 0.34),
  };

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
      h4: {
        fontSize: '1.9rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
      },
      h5: {
        fontSize: '1.4rem',
        fontWeight: 650,
        letterSpacing: '-0.01em',
      },
      h6: {
        fontSize: '1.05rem',
        fontWeight: 600,
      },
      subtitle1: {
        color: palette.text.secondary,
      },
      body2: {
        color: palette.text.muted ?? palette.text.secondary,
      },
    },
    shape: {
      borderRadius: 14,
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: palette.background.default,
          },
        },
      },
      MuiCard: {
        styleOverrides: {
          root: {
            backgroundColor: palette.background.paper,
            border: `1px solid ${surfaceBorder}`,
            boxShadow: `0 14px 30px ${alpha('#000000', mode === 'dark' ? 0.26 : 0.12)}`,
            transition: 'transform 0.2s ease-in-out, box-shadow 0.2s ease-in-out',
          },
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
            borderColor: surfaceBorder,
          },
        },
      },
      MuiAppBar: {
        styleOverrides: {
          root: {
            backgroundColor: palette.background.topbar ?? palette.background.paper,
            borderBottom: `1px solid ${dividerColor}`,
          },
        },
      },
      MuiDrawer: {
        styleOverrides: {
          paper: {
            backgroundColor: palette.background.sidebar ?? palette.background.paper,
            borderRight: `1px solid ${dividerColor}`,
          },
        },
      },
      MuiDivider: {
        styleOverrides: {
          root: {
            borderColor: dividerColor,
          },
        },
      },
      MuiCardContent: {
        styleOverrides: {
          root: {
            padding: 24,
            '&:last-child': {
              paddingBottom: 24,
            },
          },
        },
      },
      MuiTableContainer: {
        styleOverrides: {
          root: {
            border: `1px solid ${surfaceBorder}`,
            borderRadius: 14,
            overflow: 'hidden',
          },
        },
      },
      MuiTableCell: {
        styleOverrides: {
          head: {
            color: palette.text.secondary,
            fontSize: '0.78rem',
            fontWeight: 600,
            letterSpacing: '0.05em',
            textTransform: 'uppercase',
          },
        },
      },
      MuiOutlinedInput: {
        styleOverrides: {
          root: {
            backgroundColor: inputBackground,
            borderRadius: 10,
            '& .MuiOutlinedInput-notchedOutline': {
              borderColor: alpha(palette.text.primary, 0.2),
            },
            '&:hover .MuiOutlinedInput-notchedOutline': {
              borderColor: focusRing,
            },
            '&.Mui-focused .MuiOutlinedInput-notchedOutline': {
              borderWidth: 1.5,
              borderColor: focusRing,
            },
          },
          input: {
            color: palette.text.primary,
          },
        },
      },
      MuiInputLabel: {
        styleOverrides: {
          root: {
            color: palette.text.secondary,
          },
        },
      },
      MuiButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            textTransform: 'none',
            fontWeight: 600,
            minHeight: 40,
            transition: 'transform 0.15s ease-in-out, box-shadow 0.15s ease-in-out, background-color 0.15s ease-in-out',
            '&:not(.Mui-disabled):hover': {
              transform: 'translateY(-1px)',
            },
            '&:not(.Mui-disabled):active': {
              transform: 'translateY(0)',
            },
            '&.Mui-disabled': {
              color: disabledText,
              border: `1px solid ${alpha(palette.text.primary, 0.25)}`,
              backgroundColor: disabledBackground,
            },
          },
          contained: {
            boxShadow: 'none',
            '&:not(.Mui-disabled):hover': {
              boxShadow: `0 4px 12px ${alpha('#000000', mode === 'dark' ? 0.35 : 0.2)}`,
            },
          },
          outlined: {
            borderColor: alpha(palette.text.primary, 0.35),
          },
        },
      },
      MuiChip: {
        styleOverrides: {
          root: {
            fontWeight: 600,
            borderRadius: 8,
            border: `1px solid ${chipBorder.default}`,
            transition: 'opacity 0.15s ease-in-out, transform 0.15s ease-in-out',
          },
          colorSuccess: {
            backgroundColor: chipBackground.success,
            color: chipText.success,
            borderColor: chipBorder.success,
          },
          colorWarning: {
            backgroundColor: chipBackground.warning,
            color: chipText.warning,
            borderColor: chipBorder.warning,
          },
          colorPrimary: {
            backgroundColor: chipBackground.primary,
            color: chipText.primary,
            borderColor: chipBorder.primary,
          },
          colorDefault: {
            backgroundColor: chipBackground.default,
            color: chipText.default,
            borderColor: chipBorder.default,
          },
        },
      },
      MuiListItemButton: {
        styleOverrides: {
          root: {
            borderLeft: '3px solid transparent',
            transition: 'background-color 0.15s ease-in-out, border-left-color 0.15s ease-in-out, color 0.15s ease-in-out',
            '& .MuiListItemIcon-root': {
              transition: 'color 0.15s ease-in-out',
            },
            '&.Mui-selected': {
              borderLeftColor: palette.primary.main,
              backgroundColor: alpha(palette.primary.main, 0.1),
              '& .MuiListItemIcon-root': {
                color: palette.primary.main,
              },
              '& .MuiListItemText-primary': {
                color: palette.primary.main,
                fontWeight: 600,
              },
            },
            '&.Mui-selected:hover': {
              backgroundColor: alpha(palette.primary.main, 0.15),
            },
          },
        },
      },
      MuiIconButton: {
        styleOverrides: {
          root: {
            borderRadius: 10,
            transition: 'transform 0.15s ease-in-out, background-color 0.15s ease-in-out',
            '&:not(.Mui-disabled):hover': {
              transform: 'scale(1.08)',
            },
            '&:not(.Mui-disabled):active': {
              transform: 'scale(0.94)',
            },
          },
        },
      },
      MuiAlert: {
        styleOverrides: buildAlertStyleOverrides(palette.alerts),
      },
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
