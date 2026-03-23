/**
 * Abstract representation of a signed-in user returned by client-side
 * authentication operations.
 *
 * Consumers never need to reference the underlying provider SDK (e.g.
 * `firebase/auth`) directly — they work exclusively with this interface.
 */
export interface IAuthUser {
  /** Unique identifier for the authenticated user. */
  readonly uid: string;
  /** Email address associated with the account, or `null` if not available. */
  readonly email: string | null;
  /** Display name associated with the account, or `null` if not available. */
  readonly displayName: string | null;
  /** URL of the user's profile photo, or `null` if not available. */
  readonly photoURL: string | null;
  /**
   * Retrieves a fresh Firebase ID token for the current user, refreshing it
   * if it has expired.
   *
   * @returns A promise that resolves to the ID token string.
   */
  getIdToken(): Promise<string>;
}

/**
 * Callback invoked whenever the authentication state changes (sign-in,
 * sign-out, or token refresh).
 *
 * @param user - The newly signed-in user, or `null` when signed out.
 */
export type AuthStateListener = (user: IAuthUser | null) => void | Promise<void>;

/**
 * Abstract interface for client-side authentication operations.
 *
 * Implement this interface to swap the underlying authentication provider
 * (e.g. Firebase, Auth0) without changing any consumer code in the frontend.
 *
 * @example
 * ```typescript
 * // Stub for testing:
 * class StubClientAuth implements IClientAuth {
 *   onAuthStateChanged(listener: AuthStateListener) { return () => {}; }
 *   async signInWithEmailAndPassword() {}
 *   async signInWithGoogle() {}
 *   async signOut() {}
 *   getCurrentUser() { return null; }
 * }
 * ```
 */
export interface IClientAuth {
  /**
   * Subscribes to auth state changes.
   *
   * @param listener - Callback to invoke on every auth state change.
   * @returns An unsubscribe function that stops further callbacks when called.
   */
  onAuthStateChanged(listener: AuthStateListener): () => void;

  /**
   * Signs in using an email address and password.
   *
   * @param email    - The user's email address.
   * @param password - The user's password.
   * @throws If the credentials are invalid or the sign-in fails.
   */
  signInWithEmailAndPassword(email: string, password: string): Promise<void>;

  /**
   * Signs in using a Google OAuth popup.
   *
   * @throws If the popup is blocked or the sign-in is cancelled.
   */
  signInWithGoogle(): Promise<void>;

  /**
   * Signs out the currently authenticated user.
   */
  signOut(): Promise<void>;

  /**
   * Returns the currently signed-in user, or `null` if no user is
   * authenticated.
   */
  getCurrentUser(): IAuthUser | null;
}
