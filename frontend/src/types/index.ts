/**
 * Shared TypeScript interfaces used across the frontend.
 *
 * These types mirror the response shapes of the BFF Gateway API so that
 * API call functions and UI components share a single source of truth.
 */

/**
 * The authenticated user's profile as returned by `GET /api/v1/me`.
 * Combines Firebase Auth fields with the platform-specific role and enable flag.
 */
export interface UserProfile {
  uid: string;
  email: string;
  name?: string;
  picture?: string;
  role: 'admin' | 'user';
  /** When `false` the account is pending admin approval and access is blocked. */
  enable: boolean;
}

/**
 * A platform user record as returned by the Users API (via BFF).
 * Used in admin user-management views.
 */
export interface UserRecord {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  /** When `false` the account is disabled / pending approval. */
  enable: boolean;
}

/**
 * A pre-approved email entry that allows automatic onboarding before first sign-in.
 */
export interface PreApprovedUser {
  email: string;
  role: 'admin' | 'user';
}

/**
 * Represents a background resume-ingest job submitted to the BFF Gateway.
 */
export interface ResumeIngestJob {
  jobId: string;
  status: string;
  acceptedAt: string;
}

/**
 * Pagination metadata included in paginated BFF API responses.
 */
export interface ApiMeta {
  page: number;
  limit: number;
  total: number;
}

/**
 * Standard envelope for paginated or collection BFF API responses.
 * Mirrors the `formatSuccess` envelope produced by the Bowltie shared library.
 */
export interface ApiResponse<T> {
  success: boolean;
  data: T;
  meta?: ApiMeta;
}

/**
 * Runtime feature-flag state derived from `VITE_FEATURE_*` environment variables.
 * Access through the {@link useFeatureFlags} hook.
 */
export interface FeatureFlags {
  /** Resume ingest workflow (trigger ingestion from Google Sheets). */
  resumeIngest: boolean;
  /** Semantic resume search. */
  resumeSearch: boolean;
  /** Document reader / OCR upload. */
  documentRead: boolean;
  /** Resume document generation and download. */
  resumeGenerate: boolean;
  /** Admin user management (user list, pre-approved list). */
  userManagement: boolean;
}
