/**
 * @file theme/index.ts — Theme system public API.
 *
 * Re-exports the full configurable theme system so consumers can import
 * from a single entry-point:
 *
 * ```ts
 * import { AppThemeProvider, useAppTheme } from './theme';
 * import type { AppTheme, Palette } from './theme';
 * ```
 */

// Provider + hook
export { AppThemeProvider } from './ThemeProvider';
export { useAppTheme } from './app-theme-context';
export type { AppThemeContextValue } from './app-theme-context';

// Types
export type { AppTheme, Palette, ColorRole, Branding, Typography, Icons } from './types';

// Utilities
export { loadTheme } from './loadTheme';
export { toCssVariables, injectCssVariables } from './toCssVariables';
