/** Represents an authenticated Firebase user. */
export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  role: string;
  enable: boolean;
}

/** Augment FastifyRequest with authenticated user and correlation ID. */
declare module 'fastify' {
  interface FastifyRequest {
    user: AuthenticatedUser;
    correlationId: string;
  }
}

/** User profile data. */
export interface UserProfile {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

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

/** Request payload for generating a resume file. */
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

/** Request payload for creating a new pre-approved user. */
export interface CreatePreApprovedRequest {
  email: string;
  role: string;
}

/** Request payload for an admin updating an existing user (role / enabled status). */
export interface UpdateUserRequest {
  email?: string;
  role?: string;
  enable?: boolean;
}

/** Request payload for updating a pre-approved user. */
export interface UpdatePreApprovedRequest {
  role?: string;
}

/** Firebase Auth user record enriched with role and enable status from users-api. */
export interface UserRecord {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** Response from the list users endpoint. */
export interface ListUsersResponse {
  users: UserRecord[];
  pageToken?: string;
}

/** Pre-approved user record. */
export interface PreApprovedUser {
  email: string;
  role: string;
}

export type SortDirection = 'asc' | 'desc';
export type UserSortField = 'uid' | 'email' | 'role' | 'enable';
export type PreApprovedSortField = 'email' | 'role';

/** Filters for listing users. */
export interface UserFilters {
  email?: string;
  role?: string;
  enable?: boolean;
  orderBy?: UserSortField;
  orderDirection?: SortDirection;
}

/** Filters for listing pre-approved users. */
export interface PreApprovedFilters {
  role?: string;
  orderBy?: PreApprovedSortField;
  orderDirection?: SortDirection;
}
