/**
 * Centralized API request and response type definitions for the Elastic Resume Base
 * microservices. These types define the canonical contracts used across all
 * "toolbox" APIs and the services that consume them.
 *
 * All services should import these types via the `@shared/toolbox` path alias
 * rather than defining them locally.
 */

// ─── Users API ────────────────────────────────────────────────────────────────

/** A user record managed by the users service. */
export interface UserRecord {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** A pre-approved user record managed by the users service. */
export interface PreApprovedUser {
  email: string;
  role: string;
}

/** Request payload for the authorize endpoint. */
export interface AuthorizeRequest {
  uid: string;
  email: string;
}

/** Response from the authorize endpoint. */
export interface AuthorizeResponse {
  role: string;
  enable: boolean;
}

/** Request payload for creating a new user. */
export interface CreateUserRequest {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** Request payload for updating an existing user (role and/or enable status). */
export interface UpdateUserRequest {
  email?: string;
  role?: string;
  enable?: boolean;
}

/** Request payload for adding a new pre-approved user. */
export interface AddPreApprovedRequest {
  email: string;
  role: string;
}

/** Request payload for updating a pre-approved user. */
export interface UpdatePreApprovedRequest {
  role?: string;
}

/** Paginated list users response. */
export interface ListUsersResponse {
  users: UserRecord[];
  pageToken?: string;
}

/** Request payload for batch-updating multiple users (role and/or enable status). */
export interface BatchUpdateUsersRequest {
  uids: string[];
  role?: 'admin' | 'user';
  enable?: boolean;
}

/** Request payload for batch-deleting multiple users. */
export interface BatchDeleteUsersRequest {
  uids: string[];
}

/** Response from the batch update users endpoint. */
export interface BatchUpdateUsersResponse {
  updated: number;
}

/** Response from the batch delete users endpoint. */
export interface BatchDeleteUsersResponse {
  deleted: number;
}

/** Request payload for batch-updating multiple pre-approved users (role change). */
export interface BatchUpdatePreApprovedRequest {
  emails: string[];
  role: 'admin' | 'user';
}

/** Request payload for batch-deleting multiple pre-approved users. */
export interface BatchDeletePreApprovedRequest {
  emails: string[];
}

/** Response from the batch update pre-approved users endpoint. */
export interface BatchUpdatePreApprovedResponse {
  updated: number;
}

/** Response from the batch delete pre-approved users endpoint. */
export interface BatchDeletePreApprovedResponse {
  deleted: number;
}

export type SortDirection = 'asc' | 'desc';
export type UserSortField = 'uid' | 'email' | 'role' | 'enable';
export type PreApprovedSortField = 'email' | 'role';

/** Filters for querying users. */
export interface UserFilters {
  email?: string;
  role?: string;
  enable?: boolean;
  orderBy?: UserSortField;
  orderDirection?: SortDirection;
}

/** Filters for querying pre-approved users. */
export interface PreApprovedFilters {
  role?: string;
  orderBy?: PreApprovedSortField;
  orderDirection?: SortDirection;
}

// ─── Downloader service API ───────────────────────────────────────────────────

/** Request payload for triggering a resume ingest. */
export interface IngestRequest {
  sheetId?: string;
  batchId?: string;
  metadata?: Record<string, unknown>;
}

/** Response from the ingest endpoint. */
export interface IngestResponse {
  jobId: string;
  status: string;
  acceptedAt: string;
}

// ─── Search service API ───────────────────────────────────────────────────────

/** Request payload for a semantic search. */
export interface SearchRequest {
  query: string;
  filters?: Record<string, unknown>;
  limit?: number;
  offset?: number;
}

/** A single search result item. */
export interface SearchResult {
  id: string;
  score: number;
  data: Record<string, unknown>;
}

/** Response from the search endpoint. */
export interface SearchResponse {
  results: SearchResult[];
  total: number;
  query: string;
}

// ─── File generator service API ───────────────────────────────────────────────

/** Supported resume output formats. */
export type ResumeFormat = 'pdf' | 'docx' | 'html';

/** Request payload for generating a resume file. */
export interface GenerateRequest {
  language: string;
  format: ResumeFormat;
  outputFormats?: ResumeFormat[];
}

/** Response from the generate endpoint. */
export interface GenerateResponse {
  jobId: string;
  status: string;
  downloadUrl?: string;
  driveLink?: string;
}

// ─── Document reader service API ──────────────────────────────────────────────

/** Request payload for reading a document. */
export interface DocumentReadRequest {
  fileReference: string;
  options?: {
    extractTables?: boolean;
    language?: string;
  };
}

/** Response from the document read endpoint. */
export interface DocumentReadResponse {
  text: string;
  metadata?: Record<string, unknown>;
}
