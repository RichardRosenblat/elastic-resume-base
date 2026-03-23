/**
 * @file theme/toCssVariables.ts — CSS custom-property generator.
 *
 * Converts an {@link AppTheme} into a flat set of CSS variables and injects
 * them into the document root (`<html>`).  Calling this function again with
 * an updated theme (e.g. after toggling dark/light mode) seamlessly updates
 * every component that consumes the variables via `var(--…)`.
 *
 * Generated variable names follow the pattern:
 * - `--color-primary-main`
 * - `--color-primary-light`
 * - `--color-background-default`
 * - `--color-text-primary`
 * - `--font-family`
 *
 * @example
 * import { injectCssVariables } from './toCssVariables';
 * injectCssVariables(theme);
 * // → sets var(--color-primary-main) = '#2563EB' on <html>
 */
import type { AppTheme, ColorRole } from './types';

/**
 * Converts a {@link ColorRole} object into a flat record of CSS variable
 * fragments, e.g. `{ main: '#fff', light: '#f5f5f5' }`.
 *
 * @param prefix - The CSS variable prefix, e.g. `--color-primary`.
 * @param role   - The colour role object to flatten.
 * @returns A record mapping full variable names to colour values.
 */
function colorRoleToVars(
  prefix: string,
  role: ColorRole,
): Record<string, string> {
  const vars: Record<string, string> = {};
  vars[`${prefix}-main`] = role.main;
  if (role.light !== undefined) vars[`${prefix}-light`] = role.light;
  if (role.dark !== undefined) vars[`${prefix}-dark`] = role.dark;
  if (role.contrastText !== undefined)
    vars[`${prefix}-contrast-text`] = role.contrastText;
  return vars;
}

/**
 * Derives all CSS custom properties from the given theme.
 *
 * @param theme - The application theme to convert.
 * @returns A flat record of `{ '--variable-name': 'value' }` pairs.
 */
export function toCssVariables(theme: AppTheme): Record<string, string> {
  const { palette, typography } = theme;

  return {
    ...colorRoleToVars('--color-primary', palette.primary),
    ...colorRoleToVars('--color-secondary', palette.secondary),
    ...(palette.tertiary
      ? colorRoleToVars('--color-tertiary', palette.tertiary)
      : {}),
    ...colorRoleToVars('--color-success', palette.success),
    ...colorRoleToVars('--color-warning', palette.warning),
    ...colorRoleToVars('--color-error', palette.error),
    ...colorRoleToVars('--color-info', palette.info),
    '--color-background-default': palette.background.default,
    '--color-background-paper': palette.background.paper,
    '--color-text-primary': palette.text.primary,
    '--color-text-secondary': palette.text.secondary,
    '--font-family': typography.fontFamily,
  };
}

/**
 * Injects the CSS custom properties derived from `theme` into the
 * `<html>` element's inline style.  Any previously set variables are
 * overwritten so that repeated calls are safe and idempotent.
 *
 * @param theme - The application theme whose colours and fonts to apply.
 */
export function injectCssVariables(theme: AppTheme): void {
  const vars = toCssVariables(theme);
  const root = document.documentElement;
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value);
  }
}
