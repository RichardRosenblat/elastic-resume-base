import type { IClientAuth } from './interfaces/client-auth.js';
import type { FirebaseClientAuthOptions } from './firebase-client-auth.js';
/**
 * Provider-agnostic options for initialising the Aegis client-side
 * authentication layer.
 */
export type ClientAuthOptions = FirebaseClientAuthOptions;
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
export declare function initializeClientAuth(options: ClientAuthOptions): void;
/**
 * Terminates the Aegis client-side authentication layer and releases all
 * resources.
 *
 * This function is **idempotent**: if client auth has not been initialised it
 * is a no-op.
 */
export declare function terminateClientAuth(): Promise<void>;
/**
 * Returns the initialised client auth singleton.
 *
 * @throws {Error} If {@link initializeClientAuth} has not been called first.
 */
export declare function getClientAuth(): IClientAuth;
/**
 * Overrides the internal client auth instance.
 * **For testing only** — do not call in production code.
 */
export declare function _setClientAuth(auth: IClientAuth): void;
/**
 * Resets the internal client auth instance to null.
 * **For testing only** — do not call in production code.
 */
export declare function _resetClientAuth(): void;
//# sourceMappingURL=client-auth.d.ts.map