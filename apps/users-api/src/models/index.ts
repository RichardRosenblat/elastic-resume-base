/**
 * Users API model definitions.
 *
 * All API contract types (request/response bodies) are imported from the
 * centralized `@shared/toolbox` module and re-exported here for backward
 * compatibility with existing service and controller imports.
 *
 * Only users-api-specific types (e.g. Fastify augmentations) are defined locally.
 */

// ─── Re-exports from shared API types ────────────────────────────────────────

export type {
  UserRecord,
  PreApprovedUser,
  AuthorizeRequest,
  AuthorizeResponse,
  CreateUserRequest,
  UpdateUserRequest,
  AddPreApprovedRequest,
  UpdatePreApprovedRequest,
  ListUsersResponse,
  BatchUpdateUsersRequest,
  BatchDeleteUsersRequest,
  BatchUpdateUsersResponse,
  BatchDeleteUsersResponse,
  SortDirection,
  UserSortField,
  PreApprovedSortField,
  UserFilters,
  PreApprovedFilters,
} from '@shared/toolbox';

// ─── Fastify augmentation ─────────────────────────────────────────────────────

/** Augments the Fastify request type to include a correlation ID. */
declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation ID for distributed tracing, sourced from `x-correlation-id` header or generated. */
    correlationId: string;
    /** GCP Cloud Trace trace ID, parsed from `x-cloud-trace-context` header or derived from correlation ID. */
    traceId: string;
    /** GCP Cloud Trace span ID, parsed from `x-cloud-trace-context` header or defaulting to `"0"`. */
    spanId: string;
  }
}
