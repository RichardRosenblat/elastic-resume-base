/**
 * @file theme/types.ts — TypeScript interfaces for the application theme.
 *
 * These interfaces describe the full shape of `theme.json` and the runtime
 * theme object consumed by components via {@link useAppTheme}.
 */

/**
 * A colour role that may have up to four variants.
 * `light`, `dark`, and `contrastText` are optional so that only `main`
 * is required for simple palettes (e.g. `success`, `warning`, `error`).
 */
export interface ColorRole {
  /** The primary shade used as the default. */
  main: string;
  /** A lighter tint, typically used for hover states or backgrounds. */
  light?: string;
  /** A darker shade, typically used for pressed/active states. */
  dark?: string;
  /** Text colour that meets WCAG contrast requirements on top of `main`. */
  contrastText?: string;
}

/** Background colours for the page and elevated surfaces. */
export interface BackgroundPalette {
  /** Page/body background colour. */
  default: string;
  /** Surface background colour (cards, dialogs, drawers). */
  paper: string;
  /** Higher-emphasis surface tone for nested/elevated containers. */
  elevated?: string;
  /** Sidebar/drawer background tone. */
  sidebar?: string;
  /** Top navigation bar background tone. */
  topbar?: string;
  /** Input field background tone. */
  input?: string;
}

/** Foreground text colours. */
export interface TextPalette {
  /** High-emphasis body text. */
  primary: string;
  /** Medium-emphasis secondary / helper text. */
  secondary: string;
  /** Low-emphasis text for labels and subtle metadata. */
  muted?: string;
  /** Text used on strong accent surfaces. */
  inverse?: string;
}

/** UI-specific neutral tokens for borders, dividers and disabled states. */
export interface UiPalette {
  border?: string;
  divider?: string;
  disabledBackground?: string;
  disabledText?: string;
  focusRing?: string;
}

/** Style values for semantic badge/chip tones. */
export interface BadgeTone {
  bg: string;
  text: string;
  border?: string;
}

/** Optional custom tones used for chips/badges. */
export interface BadgePalette {
  success?: BadgeTone;
  warning?: BadgeTone;
  primary?: BadgeTone;
  default?: BadgeTone;
}

/**
 * Full colour palette mirroring the Material Design colour system.
 * All standard roles are supported; `tertiary` is an extension beyond MUI.
 */
export interface Palette {
  primary: ColorRole;
  secondary: ColorRole;
  /**
   * An optional third brand colour for accents that should not compete with
   * primary or secondary.
   */
  tertiary?: ColorRole;
  success: Pick<ColorRole, 'main'> & Partial<ColorRole>;
  warning: Pick<ColorRole, 'main'> & Partial<ColorRole>;
  error: Pick<ColorRole, 'main'> & Partial<ColorRole>;
  info: Pick<ColorRole, 'main'> & Partial<ColorRole>;
  background: BackgroundPalette;
  text: TextPalette;
  ui?: UiPalette;
  badge?: BadgePalette;
}

/** Typography settings applied to the MUI theme and CSS variables. */
export interface Typography {
  /**
   * CSS `font-family` value, e.g.
   * `'"Inter", "Roboto", "Helvetica", sans-serif'`.
   */
  fontFamily: string;
}

/** Static branding assets exposed through the theme context. */
export interface Branding {
  /** Product/app name shown as the platform identity. */
  appName: string;
  /** Company/customer name using the app. */
  companyName: string;
  /**
   * Absolute/root-relative URL or Iconify identifier (e.g. `mdi:briefcase`)
   * used as the app/platform logo.
   */
  appLogoUrl: string;
  /**
   * Absolute/root-relative URL or Iconify identifier (e.g. `mdi:domain`)
   * shown as the partner/customer logo in the topbar.
   */
  companyLogoUrl: string;
  /** @deprecated Use `appLogoUrl` instead. */
  logoUrl?: string;
  /** @deprecated Use `companyLogoUrl` instead. */
  companyLogo?: string;
}

/**
 * Default icon identifiers used across the application.
 * Values follow the Iconify `<set>:<name>` format but can be any string
 * that the icon component understands.
 */
export interface Icons {
  /** Icon shown when no other icon is specified. */
  default: string;
}

/**
 * The complete, validated application theme read from `theme.json`.
 * This is the object stored in the {@link AppThemeContext} and returned
 * by {@link useAppTheme}.
 */
export interface AppTheme {
  /**
   * Default colour-mode for the application.
   * Users can override this at runtime and the choice is persisted in
   * `localStorage` under the key `appThemeMode`.
   */
  mode: 'light' | 'dark';
  branding: Branding;
  typography: Typography;
  icons: Icons;
  palette: Palette;
}
