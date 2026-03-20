/** Augments the Fastify request type to include a correlation ID. */
declare module 'fastify' {
  interface FastifyRequest {
    /** Correlation ID for distributed tracing, sourced from `x-correlation-id` header or generated. */
    correlationId: string;
  }
}

/** A user record stored in the `users` Firestore collection. */
export interface UserRecord {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** A pre-approved user record stored in the `pre_approved_users` Firestore collection. */
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

/** Request payload for creating a new user internally. */
export interface CreateUserRequest {
  uid: string;
  email: string;
  role: string;
  enable: boolean;
}

/** Request payload for updating an existing user. */
export interface UpdateUserRequest {
  email?: string;
  role?: string;
  enable?: boolean;
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

/** Paginated list users response. */
export interface ListUsersResponse {
  users: UserRecord[];
  pageToken?: string;
}
