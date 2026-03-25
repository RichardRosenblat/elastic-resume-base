/**
 * @module @elastic-resume-base/aegis
 *
 * Aegis is the **sole** authentication abstraction layer for Elastic Resume Base
 * microservices. It owns every aspect of token verification — from SDK
 * initialisation through to decoded-token delivery — so that consuming services
 * can remain free of any direct `firebase-admin` (or other provider) dependency.
 *
 * The library is designed so that the underlying authentication provider can be
 * swapped out by providing a different {@link ITokenVerifier} implementation
 * without changing any consumer code.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { initializeAuth, getTokenVerifier } from '@elastic-resume-base/aegis';
 *
 * // Call once at application startup, before verifying any tokens.
 * initializeAuth({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project' });
 *
 * // In an auth middleware:
 * const decoded = await getTokenVerifier().verifyToken(bearerToken);
 * console.log(decoded.uid, decoded.email);
 * ```
 */

// ---------------------------------------------------------------------------
// Authentication initialisation (must be called before verifying any tokens)
// ---------------------------------------------------------------------------
export type { AuthOptions } from './auth.js';
export {
  initializeAuth,
  terminateAuth,
  getTokenVerifier,
  _setTokenVerifier,
  _resetTokenVerifier,
} from './auth.js';

// ---------------------------------------------------------------------------
// Token verifier interface & models
// ---------------------------------------------------------------------------
export type { ITokenVerifier, DecodedToken } from './interfaces/token-verifier.js';

// ---------------------------------------------------------------------------
// Firebase implementation (exported for advanced use; prefer initializeAuth)
// ---------------------------------------------------------------------------
export { FirebaseTokenVerifier } from './firebase-token-verifier.js';
export type { FirebaseAuthOptions } from './firebase-token-verifier.js';
