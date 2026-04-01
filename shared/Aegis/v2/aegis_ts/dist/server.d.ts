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
export type { AuthOptions } from './auth.js';
export { initializeAuth, terminateAuth, getTokenVerifier, _setTokenVerifier, _resetTokenVerifier, } from './auth.js';
export type { ITokenVerifier, DecodedToken } from './interfaces/token-verifier.js';
export { FirebaseTokenVerifier } from './firebase-token-verifier.js';
export type { FirebaseAuthOptions } from './firebase-token-verifier.js';
/**
 * Unified representation of an authenticated request context, derived from
 * server-side token verification.
 *
 * This type is intentionally provider-agnostic: consumers should work with
 * `RequestContext` rather than the raw `DecodedToken` from the verifier.
 *
 * @example
 * ```typescript
 * import type { RequestContext } from '@elastic-resume-base/aegis/server';
 *
 * function handleRequest(ctx: RequestContext): void {
 *   console.log(`Request by user: ${ctx.uid} (${ctx.email ?? 'no email'})`);
 * }
 * ```
 */
export interface RequestContext {
    /** Unique identifier for the authenticated user. */
    readonly uid: string;
    /** Email address associated with the account, if available. */
    readonly email?: string;
    /** Display name of the user, if available. */
    readonly name?: string;
    /** URL of the user's profile picture, if available. */
    readonly picture?: string;
}
//# sourceMappingURL=server.d.ts.map