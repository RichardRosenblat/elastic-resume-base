/**
 * Decoded claims extracted from a verified authentication token.
 *
 * This type is intentionally provider-agnostic so that consumers never need to
 * import provider-specific SDKs.
 */
export interface DecodedToken {
  /** Unique identifier for the authenticated user. */
  readonly uid: string;
  /** Email address associated with the account, if available. */
  readonly email?: string;
  /** Display name of the user, if available. */
  readonly name?: string;
  /** URL of the user's profile picture, if available. */
  readonly picture?: string;
}

/**
 * Abstract interface for token verification operations.
 *
 * Implement this interface to swap the underlying authentication provider
 * without changing any business logic that depends on it.
 *
 * @example
 * ```typescript
 * // Implement for a new auth provider:
 * class Auth0TokenVerifier implements ITokenVerifier {
 *   async verifyToken(token: string): Promise<DecodedToken> { ... }
 * }
 * ```
 */
export interface ITokenVerifier {
  /**
   * Verifies an authentication token and returns the decoded claims.
   *
   * @param token - The raw authentication token string.
   * @returns Decoded token data including at minimum the user's uid.
   * @throws If the token is invalid, expired, or cannot be verified.
   */
  verifyToken(token: string): Promise<DecodedToken>;
}
