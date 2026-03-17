import { Request } from 'express';

/** Represents a request with a correlation ID attached. */
export interface CorrelatedRequest extends Request {
  correlationId: string;
}

/** A user record stored in Firestore. */
export interface UserRecord {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role: string;
  disabled: boolean;
  createdAt?: string;
  updatedAt?: string;
}

/** Request payload for creating a new user. */
export interface CreateUserRequest {
  uid?: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  disabled?: boolean;
}

/** Request payload for updating an existing user. */
export interface UpdateUserRequest {
  email?: string;
  displayName?: string;
  photoURL?: string;
  role?: string;
  disabled?: boolean;
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
