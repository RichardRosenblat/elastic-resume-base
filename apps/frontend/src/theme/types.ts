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

/** Style values for a single alert severity tone. */
export interface AlertTone {
  /** Background colour for the standard (inline) alert variant. */
  bg?: string;
  /** Text and icon colour for the standard (inline) alert variant. */
  color?: string;
  /** Background colour for the filled alert variant (used in toast notifications). */
  filledBg?: string;
  /** Text colour for the filled alert variant (used in toast notifications). */
  filledColor?: string;
}

/** Optional custom colour overrides for each alert severity type. */
export interface AlertPalette {
  success?: AlertTone;
  warning?: AlertTone;
  error?: AlertTone;
  info?: AlertTone;
  default?: AlertTone;
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
  /**
   * Per-severity colour overrides for MUI `Alert` components.
   * When omitted, MUI derives alert colours automatically from the semantic
   * palette roles (`success`, `warning`, `error`, `info`).
   */
  alerts?: AlertPalette;
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
   * URL, root-relative path, bare filename, or Iconify identifier used as
   * the app/platform logo.
   *
   * Accepted forms:
   * - `https://cdn.example.com/logo.png` — external URL
   * - `/logo.png` or `/assets/logo.png` — root-relative path (file served from `dist/` / `public/`)
   * - `logo.png` or `./images/logo.png` — bare filename / relative path, resolved against the
   *   app root so it points to a file in the `public/` folder (Vite copies `public/` verbatim
   *   into `dist/` on build)
   * - `mdi:briefcase` — Iconify icon identifier (no image file needed)
   * - `data:image/…` — inline base64 data URI
   */
  appLogoUrl: string;
  /**
   * URL, root-relative path, bare filename, or Iconify identifier shown as
   * the partner/customer logo in the topbar.
   *
   * Accepted forms: same as {@link appLogoUrl}.
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
 * Configuration for a single sidebar navigation item override.
 * Allows theme authors to control visibility, access level, and ordering
 * for each route without touching component code.
 */
export interface SidebarItemConfig {
  /** Route path this config applies to (e.g. `'/'`, `'/users'`). */
  path: string;
  /**
   * Display order for this item.  Items are sorted ascending by this value;
   * items without an explicit order retain their default order.
   */
  order?: number;
  /** When `true`, the item cannot be reordered relative to other items. */
  locked?: boolean;
  /** When `true`, this item is only shown to admin users. */
  adminOnly?: boolean;
  /** When `true`, this item is hidden from the sidebar entirely. */
  hidden?: boolean;
}

/**
 * Sidebar-specific configuration block that can be placed inside the theme
 * JSON files to customise the navigation drawer without changing component
 * code.
 */
export interface SidebarConfig {
  /**
   * Route path of the application's main / home screen.
   * The sidebar item for this path is always shown first (unless another
   * item has a lower `order` value that overrides it).
   */
  mainScreen?: string;
  /**
   * Per-item overrides.  Each entry is merged into the corresponding
   * {@link NavItem} resolved at runtime.
   */
  items?: SidebarItemConfig[];
  /**
   * When `true`, the sidebar starts in the collapsed (icons-only) state.
   * Defaults to `false`.
   */
  defaultCollapsed?: boolean;
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
  /**
   * Optional sidebar / navigation drawer configuration.
   * When omitted, the sidebar uses its built-in defaults.
   */
  sidebar?: SidebarConfig;
}
