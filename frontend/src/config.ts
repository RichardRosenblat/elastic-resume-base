/**
 * Runtime configuration for the frontend application.
 *
 * All values are read from Vite `VITE_` environment variables at build time.
 * Copy `.env.example` to `.env.local` and fill in the required values for
 * local development. In production, supply the variables through the build
 * pipeline / deployment platform (e.g. Docker, Firebase Hosting).
 *
 * @example
 * import { config } from './config';
 * const baseUrl = config.bffUrl; // 'http://localhost:3000'
 */
export const config = {
  appName: import.meta.env.VITE_APP_NAME ?? 'Elastic Resume Base',
  bffUrl: import.meta.env.VITE_BFF_URL ?? 'http://localhost:3000',
  primaryColor: import.meta.env.VITE_PRIMARY_COLOR ?? '#1976d2',
  secondaryColor: import.meta.env.VITE_SECONDARY_COLOR ?? '#9c27b0',
  logoUrl: import.meta.env.VITE_LOGO_URL ?? null,
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
