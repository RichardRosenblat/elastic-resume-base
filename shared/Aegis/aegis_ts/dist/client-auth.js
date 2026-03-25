import { FirebaseClientAuth } from './firebase-client-auth.js';
let _clientAuth = null;
/**
 * Initialises the Aegis client-side authentication layer.
 *
 * This function is **idempotent**: subsequent calls after the first successful
 * initialisation are no-ops.  Call it once at application startup (e.g. in
 * the module that creates the React root) before any auth operations are
 * performed.
 *
 * Consuming code should never import `firebase/auth` directly; delegate all
 * client-side authentication concerns to Aegis.
 *
 * @param options - Client auth initialisation options.
 *
 * @example
 * ```typescript
 * import { initializeClientAuth } from '@elastic-resume-base/aegis/client';
 *
 * initializeClientAuth({
 *   apiKey:     import.meta.env.VITE_FIREBASE_API_KEY,
 *   authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
 *   projectId:  import.meta.env.VITE_FIREBASE_PROJECT_ID,
 * });
 * ```
 */
export function initializeClientAuth(options) {
    if (_clientAuth !== null) {
        return;
    }
    _clientAuth = new FirebaseClientAuth(options);
}
/**
 * Terminates the Aegis client-side authentication layer and releases all
 * resources.
 *
 * This function is **idempotent**: if client auth has not been initialised it
 * is a no-op.
 */
export async function terminateClientAuth() {
    _clientAuth = null;
}
/**
 * Returns the initialised client auth singleton.
 *
 * @throws {Error} If {@link initializeClientAuth} has not been called first.
 */
export function getClientAuth() {
    if (_clientAuth === null) {
        throw new Error('Aegis: client auth not initialized. Call initializeClientAuth() before use.');
    }
    return _clientAuth;
}
/**
 * Overrides the internal client auth instance.
 * **For testing only** — do not call in production code.
 */
export function _setClientAuth(auth) {
    _clientAuth = auth;
}
/**
 * Resets the internal client auth instance to null.
 * **For testing only** — do not call in production code.
 */
export function _resetClientAuth() {
    _clientAuth = null;
}
//# sourceMappingURL=client-auth.js.map