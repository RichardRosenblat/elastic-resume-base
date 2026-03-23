/**
 * @file theme/loadTheme.ts — Theme JSON loader with runtime validation.
 *
 * Reads `theme.json`, verifies the minimum required fields are present, and
 * returns a fully-typed {@link AppTheme} object.  Because this module imports
 * the JSON statically (Vite resolves `?url` or direct JSON imports at
 * build time), it works without any network request at runtime.
 *
 * @example
 * import { loadTheme } from './loadTheme';
 * const theme = loadTheme();
 * console.log(theme.palette.primary.main); // '#2563EB'
 */
import type { AppTheme } from './types';
import rawTheme from './theme.json';

/**
 * Asserts that `value` is a non-null object.
 * Used for basic structural checks before the TypeScript cast.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Validates the raw parsed JSON and throws a descriptive error when a
 * required section is missing.
 *
 * Only the top-level required keys are checked here.  Deep field validation
 * is left to TypeScript's static type system, which is sufficient for a
 * developer-controlled config file.
 *
 * @param raw - The untyped object read from `theme.json`.
 * @throws {Error} If any required top-level field is absent or malformed.
 */
function validateTheme(raw: unknown): asserts raw is AppTheme {
  if (!isObject(raw)) {
    throw new Error('[Theme] theme.json must be a JSON object.');
  }

  const required = ['mode', 'branding', 'typography', 'palette'] as const;
  for (const key of required) {
    if (!(key in raw)) {
      throw new Error(`[Theme] theme.json is missing required field: "${key}".`);
    }
  }

  if (raw['mode'] !== 'light' && raw['mode'] !== 'dark') {
    throw new Error('[Theme] theme.json "mode" must be "light" or "dark".');
  }

  if (!isObject(raw['branding'])) {
    throw new Error('[Theme] theme.json "branding" must be an object.');
  }

  if (!isObject(raw['palette'])) {
    throw new Error('[Theme] theme.json "palette" must be an object.');
  }

  const palette = raw['palette'] as Record<string, unknown>;
  for (const role of ['primary', 'secondary', 'background', 'text'] as const) {
    if (!isObject(palette[role])) {
      throw new Error(`[Theme] theme.json "palette.${role}" must be an object.`);
    }
  }
}

/**
 * Loads and validates `theme.json`, returning a typed {@link AppTheme}.
 *
 * The function is intentionally synchronous and throws on invalid config so
 * that misconfigured theme files fail fast at startup rather than surfacing
 * subtle rendering bugs at runtime.
 *
 * @returns The validated application theme.
 * @throws {Error} When `theme.json` is structurally invalid.
 */
export function loadTheme(): AppTheme {
  validateTheme(rawTheme);
  return rawTheme;
}
