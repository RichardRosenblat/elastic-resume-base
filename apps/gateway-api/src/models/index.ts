/**
 * BFF Gateway model definitions.
 *
 * All API contract types (request/response bodies shared with downstream services)
 * are imported from the centralized `@shared/toolbox` module and re-exported here
 * for backward compatibility.
 *
 * Only BFF-specific types (e.g. authenticated user, Fastify augmentations) are
 * defined locally.
 */

// ─── Re-exports from shared API types ────────────────────────────────────────

export type {
  UserRecord,
  PreApprovedUser,
  ListUsersResponse,
  UpdateUserRequest,
  UpdatePreApprovedRequest,
  AddPreApprovedRequest,
  BatchUpdateUsersRequest,
  BatchDeleteUsersRequest,
  BatchUpdateUsersResponse,
  BatchDeleteUsersResponse,
  SortDirection,
  UserSortField,
  PreApprovedSortField,
  UserFilters,
  PreApprovedFilters,
  IngestRequest,
  IngestResponse,
  SearchRequest,
  SearchResult,
  SearchResponse,
  ResumeFormat,
  GenerateRequest,
  GenerateResponse,
  DocumentReadRequest,
  DocumentReadResponse,
} from '@shared/toolbox';

// ─── BFF-specific type aliases ────────────────────────────────────────────────

/** @deprecated Use {@link AddPreApprovedRequest} from `@shared/toolbox` instead. */
export type { AddPreApprovedRequest as CreatePreApprovedRequest } from '@shared/toolbox';

// ─── BFF-specific types ───────────────────────────────────────────────────────

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
    traceId: string;
    spanId: string;
  }
}

/** User profile data. */
export interface UserProfile {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
}
