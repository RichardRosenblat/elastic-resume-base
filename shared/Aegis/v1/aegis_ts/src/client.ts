/**
 * @module @elastic-resume-base/aegis/client
 *
 * Aegis client-side authentication abstraction for browser environments.
 *
 * Provides a provider-agnostic interface for all client-side Firebase Auth
 * operations so that consuming code (e.g. the React frontend) never needs to
 * import `firebase/auth` directly.  Swapping the underlying auth provider
 * requires only a new {@link IClientAuth} implementation — no changes in
 * consumer code.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { initializeClientAuth, getClientAuth } from '@elastic-resume-base/aegis/client';
 *
 * // Call once at application startup (e.g. in the module that mounts React).
 * initializeClientAuth({
 *   apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
 *   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
 *   projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
 * });
 *
 * // In an AuthContext / auth hook:
 * const auth = getClientAuth();
 *
 * auth.onAuthStateChanged((user) => {
 *   console.log(user ? `Signed in: ${user.email}` : 'Signed out');
 * });
 *
 * await auth.signInWithEmailAndPassword('user@example.com', 'password');
 * await auth.signInWithGoogle();
 * await auth.signOut();
 *
 * const token = await auth.getCurrentUser()?.getIdToken();
 * ```
 */

// ---------------------------------------------------------------------------
// Client auth initialisation (must be called before any auth operations)
// ---------------------------------------------------------------------------
export type { ClientAuthOptions } from './client-auth.js';
export {
  initializeClientAuth,
  terminateClientAuth,
  getClientAuth,
  _setClientAuth,
  _resetClientAuth,
} from './client-auth.js';

// ---------------------------------------------------------------------------
// Client auth interface & models
// ---------------------------------------------------------------------------
export type { IClientAuth, IAuthUser, AuthStateListener } from './interfaces/client-auth.js';

// ---------------------------------------------------------------------------
// Firebase implementation (exported for advanced use; prefer initializeClientAuth)
// ---------------------------------------------------------------------------
export { FirebaseClientAuth } from './firebase-client-auth.js';
export type { FirebaseClientAuthOptions } from './firebase-client-auth.js';
