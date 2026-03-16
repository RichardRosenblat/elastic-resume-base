import { Request } from 'express';

/** Represents an authenticated Firebase user. */
export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}

/** Express Request extended with authenticated user and correlation ID. */
export interface AuthenticatedRequest extends Request {
  user: AuthenticatedUser;
  correlationId: string;
}

/** Standard API response envelope. */
export interface ApiResponse<T = unknown> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  correlationId?: string;
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

/** Request payload for creating a new Firebase Auth user. */
export interface CreateUserRequest {
  email: string;
  password: string;
  displayName?: string;
  photoURL?: string;
  disabled?: boolean;
}

/** Request payload for updating an existing Firebase Auth user. */
export interface UpdateUserRequest {
  email?: string;
  password?: string;
  displayName?: string;
  photoURL?: string;
  disabled?: boolean;
}

/** Firebase Auth user record. */
export interface UserRecord {
  uid: string;
  email?: string;
  displayName?: string;
  photoURL?: string;
  disabled: boolean;
  emailVerified: boolean;
  createdAt?: string;
  lastLoginAt?: string;
}

/** Response from the list users endpoint. */
export interface ListUsersResponse {
  users: UserRecord[];
  pageToken?: string;
}
