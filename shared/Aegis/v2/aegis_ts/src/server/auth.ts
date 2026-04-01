import { FirebaseTokenVerifier } from './firebase-token-verifier.js';
import type { ITokenVerifier } from './interfaces/token-verifier.js';
import type { FirebaseAuthOptions } from './firebase-token-verifier.js';

/**
 * Provider-agnostic options for initialising the Aegis authentication layer.
 *
 * Names are intentionally generic so that consuming services never need to
 * reference `firebase-admin` or any other provider-specific package.
 */
export type AuthOptions = FirebaseAuthOptions;

let _verifier: ITokenVerifier | null = null;

/**
 * Initialises the Aegis authentication layer.
 *
 * This function is **idempotent**: subsequent calls after the first successful
 * initialisation are no-ops. Call it once at application startup before any
 * token verification is performed.
 *
 * Consuming services should never import `firebase-admin` directly; delegate
 * all authentication concerns (including initialisation) to Aegis.
 *
 * @param options - Authentication initialisation options.
 *
 * @example
 * ```typescript
 * import { initializeAuth } from '@elastic-resume-base/aegis';
 *
 * initializeAuth({
 *   projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
 * });
 * ```
 */
export function initializeAuth(options: AuthOptions): void {
  if (_verifier !== null) {
    return;
  }
  _verifier = new FirebaseTokenVerifier(options);
}

/**
 * Terminates the Aegis authentication layer and releases all resources.
 *
 * This function is **idempotent**: if authentication has not been initialised,
 * it is a no-op. Call it during graceful shutdown.
 *
 * @example
 * ```typescript
 * import { terminateAuth } from '@elastic-resume-base/aegis';
 *
 * process.on('SIGTERM', async () => {
 *   await terminateAuth();
 *   process.exit(0);
 * });
 * ```
 */
export async function terminateAuth(): Promise<void> {
  _verifier = null;
}

/**
 * Returns the initialised token verifier singleton.
 *
 * @throws {Error} If {@link initializeAuth} has not been called first.
 */
export function getTokenVerifier(): ITokenVerifier {
  if (_verifier === null) {
    throw new Error(
      'Aegis: authentication not initialized. Call initializeAuth() before use.',
    );
  }
  return _verifier;
}

/**
 * Overrides the internal token verifier instance.
 * **For testing only** — do not call in production code.
 */
export function _setTokenVerifier(verifier: ITokenVerifier): void {
  _verifier = verifier;
}

/**
 * Resets the internal token verifier instance to null.
 * **For testing only** — do not call in production code.
 */
export function _resetTokenVerifier(): void {
  _verifier = null;
}
