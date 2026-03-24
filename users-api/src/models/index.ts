/** Augments the Fastify request type to include a correlation ID. */
declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation ID for distributed tracing, sourced from `x-correlation-id` header or generated. */
    correlationId: string;
  }
}

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

/** Request payload for updating an existing user. */
export interface UpdateUserRequest {
  role?: string;
  enable?: boolean;
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

/** Request payload for adding a pre-approved user. */
export interface AddPreApprovedRequest {
  email: string;
  role: string;
}

/** Request payload for updating a pre-approved user. */
export interface UpdatePreApprovedRequest {
  role?: string;
}

/** Filters for querying pre-approved users. */
export interface PreApprovedFilters {
  role?: string;
  orderBy?: PreApprovedSortField;
  orderDirection?: SortDirection;
}

/** Paginated list users response. */
export interface ListUsersResponse {
  users: UserRecord[];
  pageToken?: string;
}
