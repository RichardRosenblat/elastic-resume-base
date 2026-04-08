/**
 * @module @elastic-resume-base/aegis/server
 *
 * Aegis **server-side** authentication abstraction for Node.js services.
 *
 * This module owns every aspect of server-side token verification — from SDK
 * initialisation through to decoded-token delivery — so that consuming services
 * can remain free of any direct `firebase-admin` (or other provider) dependency.
 *
 * **Do not import this module in browser/frontend code.** Use
 * `@elastic-resume-base/aegis/client` instead.
 *
 * ## Quick Start
 *
 * ```typescript
 * import { initializeAuth, getTokenVerifier } from '@elastic-resume-base/aegis/server';
 *
 * // Call once at application startup, before verifying any tokens.
 * initializeAuth({ projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project' });
 *
 * // In an auth middleware:
 * const decoded = await getTokenVerifier().verifyToken(bearerToken);
 * const ctx: RequestContext = { uid: decoded.uid, email: decoded.email };
 * ```
 */
export { initializeAuth, terminateAuth, getTokenVerifier, _setTokenVerifier, _resetTokenVerifier, } from './auth.js';
// ---------------------------------------------------------------------------
// Firebase implementation (exported for advanced use; prefer initializeAuth)
// ---------------------------------------------------------------------------
export { FirebaseTokenVerifier } from './firebase-token-verifier.js';
//# sourceMappingURL=index.js.map