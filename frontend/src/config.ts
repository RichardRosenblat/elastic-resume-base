/**
 * Runtime configuration for the frontend application.
 *
 * Only infrastructure / connectivity settings live here.  Visual branding
 * (colours, fonts, company name, logo) is configured in
 * `src/theme/theme.json` instead, keeping concerns cleanly separated.
 *
 * Values are read from Vite `VITE_` environment variables at build time.
 * For local development, values are loaded automatically from the monorepo
 * `config.yaml` at the repository root.
 * See `vite.config.ts` for how `config.yaml` is ingested.
 *
 * In production (Docker / CI), pass variables as build-time `ARG`/`ENV` or
 * through your deployment platform.
 *
 * SEPARATION OF CONCERNS
 * ──────────────────────
 *   • Operational / infrastructure config → here (via VITE_* env vars)
 *   • Appearance (colours, fonts, branding) → src/theme/theme.json
 *
 * @example
 * import { config } from './config';
 * const baseUrl = config.bffUrl; // 'http://localhost:3000'
 */
export const config = {
  bffUrl: import.meta.env.VITE_BFF_URL ?? 'http://localhost:3000',
  /**
   * Support contact email shown in the footer of every page.
   * Set `VITE_SUPPORT_EMAIL` to a non-empty string to enable the footer link.
   * Leave empty (default) to hide the support footer entirely.
   */
  supportEmail: import.meta.env.VITE_SUPPORT_EMAIL ?? '',
  firebase: {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? '',
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? '',
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? 'demo-elastic-resume-base',
  },
  features: {
    resumeIngest: import.meta.env.VITE_FEATURE_RESUME_INGEST === 'true',
    resumeSearch: import.meta.env.VITE_FEATURE_RESUME_SEARCH === 'true',
    documentRead: import.meta.env.VITE_FEATURE_DOCUMENT_READ === 'true',
    resumeGenerate: import.meta.env.VITE_FEATURE_RESUME_GENERATE === 'true',
    userManagement: import.meta.env.VITE_FEATURE_USER_MANAGEMENT !== 'false',
  },
} as const;
