/**
 * @file theme/loadTheme.ts — Theme JSON loader with runtime validation.
 *
 * Reads `theme.json` (template) and, when present, `theme.local.json`
 * (developer/local active override). It validates the selected theme and
 * returns a fully-typed {@link AppTheme} object.
 *
 * @example
 * import { loadTheme } from './loadTheme';
 * const theme = loadTheme();
 * console.log(theme.palette.primary.main); // '#2563EB'
 */
import type { AppTheme } from './types';
import templateTheme from './theme.json';

const localThemeModules = import.meta.glob('./theme.local.json', { eager: true });
type RawBranding = {
  appName?: string;
  companyName?: string;
  appLogoUrl?: string;
  companyLogoUrl?: string;
  logoUrl?: string;
  companyLogo?: string;
};

type RawTheme = Omit<AppTheme, 'branding'> & {
  branding: RawBranding;
};

/**
 * Asserts that `value` is a non-null object.
 * Used for basic structural checks before the TypeScript cast.
 */
function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Resolves `$varName` references throughout a raw theme object.
 *
 * Variables must be declared in the top-level `"variables"` key as a flat
 * `{ name: value }` map.  Every string value in the rest of the theme that
 * matches the pattern `$<identifier>` is replaced with the corresponding
 * variable value.  References to undeclared variables are left unchanged.
 * Variable values themselves are never recursively resolved.
 *
 * @param raw - The untyped object read from `theme.json`.
 * @returns A new object with all variable references substituted.
 */
export function resolveVariables(raw: Record<string, unknown>): Record<string, unknown> {
  const variables = raw['variables'];
  if (!isObject(variables)) return raw;

  const vars = variables as Record<string, string>;

  function resolveValue(value: unknown): unknown {
    if (typeof value === 'string') {
      return value.replace(/\$([A-Za-z][A-Za-z0-9_]*)/g, (match, name: string) => {
        return typeof vars[name] === 'string' ? (vars[name] as string) : match;
      });
    }
    if (Array.isArray(value)) {
      return value.map(resolveValue);
    }
    if (isObject(value)) {
      const result: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(value)) {
        result[k] = resolveValue(v);
      }
      return result;
    }
    return value;
  }

  // Resolve variable references in all top-level fields except 'variables'
  // itself so that variable definitions are never self-substituted.
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(raw)) {
    result[key] = key === 'variables' ? value : resolveValue(value);
  }
  return result;
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
function validateTheme(raw: unknown): asserts raw is RawTheme {
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

  const branding = raw['branding'] as Record<string, unknown>;
  const appName = branding['appName'];
  const companyName = branding['companyName'];
  const appLogoUrl = branding['appLogoUrl'] ?? branding['logoUrl'];
  const companyLogoUrl = branding['companyLogoUrl'] ?? branding['companyLogo'];
  if (appName !== undefined && typeof appName !== 'string') {
    throw new Error('[Theme] theme.json "branding.appName" must be a string when provided.');
  }
  if (companyName !== undefined && typeof companyName !== 'string') {
    throw new Error('[Theme] theme.json "branding.companyName" must be a string when provided.');
  }
  if (appLogoUrl !== undefined && typeof appLogoUrl !== 'string') {
    throw new Error('[Theme] theme.json "branding.appLogoUrl" must be a string when provided.');
  }
  if (companyLogoUrl !== undefined && typeof companyLogoUrl !== 'string') {
    throw new Error('[Theme] theme.json "branding.companyLogoUrl" must be a string when provided.');
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
 * Resolves a logo value to a usable URL/identifier.
 *
 * Accepted forms (evaluated in order):
 * 1. Empty string → returned as-is (no image rendered).
 * 2. `mdi:<name>` → Iconify icon identifier, returned as-is.
 * 3. `data:` URI → inline image, returned as-is.
 * 4. `https://`, `http://`, or `//` → external or protocol-relative URL, returned as-is.
 * 5. `/` prefix → root-relative path already pointing into `dist/` / `public/`, returned as-is.
 * 6. Any other string (bare filename or relative path like `logo.png` or `./images/logo.png`)
 *    → treated as a path relative to the application root; a leading `/` is prepended so that
 *    it resolves to the file served from the app's `dist/` / `public/` folder (e.g. the Vite
 *    `public/` directory, which is copied verbatim to `dist/` on build).
 *
 * @param value - The raw string from `theme.json` branding config.
 * @returns The normalized string ready for use as an `<img src>` or Iconify `icon`.
 */
export function resolveLogoUrl(value: string): string {
  if (!value) return '';
  if (value.startsWith('mdi:')) return value;
  if (value.startsWith('data:')) return value;
  if (value.startsWith('https://') || value.startsWith('http://') || value.startsWith('//')) return value;
  if (value.startsWith('/')) return value;
  // Bare filename or relative path — anchor it to the app root so it
  // always resolves to the dist/public folder regardless of the current route.
  const stripped = value.startsWith('./') ? value.slice(2) : value;
  return `/${stripped}`;
}

/**
 * Supports legacy branding shape while enforcing explicit app/company naming.
 */
function normalizeTheme(raw: RawTheme): AppTheme {
  const fallbackName = raw.branding.companyName || 'Elastic Resume Base';
  const appLogoUrl = resolveLogoUrl(raw.branding.appLogoUrl || raw.branding.logoUrl || '');
  const companyLogoUrl = resolveLogoUrl(raw.branding.companyLogoUrl || raw.branding.companyLogo || '');
  return {
    ...raw,
    branding: {
      ...raw.branding,
      appName: raw.branding.appName || fallbackName,
      companyName: raw.branding.companyName || fallbackName,
      appLogoUrl,
      companyLogoUrl,
      logoUrl: appLogoUrl,
      companyLogo: companyLogoUrl,
    },
  };
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
  const localTheme = (localThemeModules['./theme.local.json'] as { default?: unknown } | undefined)?.default;
  const rawTheme = localTheme ?? templateTheme;
  const resolvedTheme = isObject(rawTheme) ? resolveVariables(rawTheme) : rawTheme;
  validateTheme(resolvedTheme);
  return normalizeTheme(resolvedTheme);
}
