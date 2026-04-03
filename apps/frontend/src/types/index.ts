/**
 * Shared TypeScript interfaces used across the frontend.
 *
 * These types mirror the response shapes of the Gateway API so that
 * API call functions and UI components share a single source of truth.
 *
 * Gateway API envelope types are imported directly from the shared Bowltie
 * library so the frontend always uses the canonical definitions produced
 * by the same library that formats the responses on the server side.
 */

// Re-export the canonical Gateway API response envelope types from the shared
// Bowltie library.  These replace the previously local ApiResponse / ApiMeta
// definitions and ensure the frontend stays in sync with server-side formatting.
export type {
  ResponseMeta,
  SuccessResponse,
  ErrorResponse,
  ApiResponse,
} from '@elastic-resume-base/bowltie';

/**
 * The authenticated user's profile as returned by `GET /api/v1/users/me`.
 * Combines persisted platform fields with optional identity details.
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
 * A platform user record as returned by the Users API (via Gateway API).
 * Used in admin user-management views.
 */
export interface UserRecord {
  uid: string;
  email: string;
  role: 'admin' | 'user';
  /** When `false` the account is disabled / pending approval. */
  enable: boolean;
}

/** Payload returned by the admin users list endpoint. */
export interface ListUsersData {
  users: UserRecord[];
  pageToken?: string;
}

export type SortDirection = 'asc' | 'desc';
export type UserSortField = 'uid' | 'email' | 'role' | 'enable';
export type PreApprovedSortField = 'email' | 'role';

/**
 * A pre-approved email entry that allows automatic onboarding before first sign-in.
 */
export interface PreApprovedUser {
  email: string;
  role: 'admin' | 'user';
}

/**
 * Represents a background resume-ingest job submitted to the Gateway API.
 */
export interface ResumeIngestJob {
  jobId: string;
  status: string;
  acceptedAt: string;
}

/** Async generation job returned by the Gateway API generate endpoint. */
export interface ResumeGenerateJob {
  jobId: string;
  status: string;
  downloadUrl?: string;
  driveLink?: string;
}

/** Search result item returned by the Gateway API search endpoint. */
export interface SearchResult {
  id: string;
  score: number;
  data: Record<string, unknown>;
}

/** Payload returned by the Gateway API search endpoint. */
export interface SearchResponseData {
  results: SearchResult[];
  total: number;
  query: string;
}

/** Status of a single downstream service as returned by `GET /health/downstream`. */
export interface DownstreamServiceStatus {
  /** `true` if the service is currently reachable (L4 connectivity). */
  live: boolean;
  /**
   * `warm` if seen alive within the configured TTL (instant reply expected);
   * `cold` if not contacted recently (cold start may be required).
   */
  temperature: 'warm' | 'cold';
  /** ISO 8601 timestamp of the last successful contact, or `null` if never seen. */
  lastSeenAlive: string | null;
  /** ISO 8601 timestamp of the most recent health-check attempt. */
  lastChecked: string;
}

/** Response shape of the Gateway API `GET /health/downstream` endpoint. */
export interface DownstreamHealthData {
  downstream: Record<string, DownstreamServiceStatus>;
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
  /**
   * When `true`, features that are disabled (their flag is `false`) are
   * hidden entirely from the sidebar and dashboard instead of being shown
   * in a "coming soon" state.
   */
  hideIfDisabled: boolean;
}
