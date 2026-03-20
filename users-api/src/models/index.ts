/** Augments the Fastify request type to include a correlation ID. */
declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation ID for distributed tracing, sourced from `x-correlation-id` header or generated. */
    correlationId: string;
  }
}

/** A user record stored in Firestore. */
export interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: string;
  disabled: boolean;
  /** Whether the user account is active and allowed to access the application. */
  enabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Request payload for creating a new user. */
export interface CreateUserRequest {
  /** Firebase uid – must be provided and must match the authenticated user's uid. */
  uid?: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  disabled?: boolean;
  /** Whether the user is enabled (active). Defaults to true. Takes precedence over `disabled`. */
  enabled?: boolean;
}

/** Request payload for updating an existing user. */
export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  disabled?: boolean;
  enabled?: boolean;
}

/** Paginated list users response. */
export interface ListUsersResponse {
  users: UserRecord[];
  pageToken?: string;
}

/** Response from the role/access check endpoint. */
export interface RoleResponse {
  role: string;
}

/** Request body for batch role lookup. */
export interface BatchRolesRequest {
  uids: string[];
}

/** An entry in the pre-approved users allowlist. */
export interface AllowlistEntry {
  /** The user's email address (primary key). Stored normalised to lowercase. */
  email: string;
  /** Optional role to assign when the user is onboarded. Defaults to 'user'. */
  role?: string;
}

/** Request payload for upserting an allowlist entry. */
export interface UpsertAllowlistRequest {
  email: string;
  role?: string;
}
