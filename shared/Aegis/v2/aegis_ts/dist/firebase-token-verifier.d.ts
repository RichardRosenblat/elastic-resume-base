import type { ITokenVerifier, DecodedToken } from './interfaces/token-verifier.js';
/**
 * Options for initializing the {@link FirebaseTokenVerifier}.
 *
 * These are intentionally Firebase-agnostic names so that consuming services
 * never need to import or reference `firebase-admin` directly.
 */
export interface FirebaseAuthOptions {
    /** Firebase / Google Cloud project identifier. */
    readonly projectId: string;
    /**
     * Service-account credentials as a raw JSON string **or** a Base64-encoded
     * JSON string.  When omitted, Application Default Credentials (ADC) are used.
     */
    readonly serviceAccountKey?: string;
}
/**
 * Firebase implementation of {@link ITokenVerifier}.
 *
 * Verifies Firebase ID tokens using the Firebase Admin SDK.  The underlying
 * Firebase app is initialised lazily on construction: if an app has already
 * been initialised (e.g. by Synapse), it is reused rather than creating a
 * second instance.
 *
 * @example
 * ```typescript
 * import { FirebaseTokenVerifier } from '@elastic-resume-base/aegis';
 *
 * const verifier = new FirebaseTokenVerifier({
 *   projectId: process.env.FIREBASE_PROJECT_ID ?? 'demo-project',
 * });
 *
 * const decoded = await verifier.verifyToken(idToken);
 * console.log(decoded.uid, decoded.email);
 * ```
 */
export declare class FirebaseTokenVerifier implements ITokenVerifier {
    private readonly app;
    /**
     * Creates a new {@link FirebaseTokenVerifier} instance.
     *
     * If a Firebase Admin app has already been initialised (e.g. by the Synapse
     * library), it is reused.  Otherwise, a new app is initialised using the
     * provided `projectId` and, when supplied, the `serviceAccountKey`.
     *
     * @param options - Firebase project and credentials configuration.
     */
    constructor(options: FirebaseAuthOptions);
    /**
     * Verifies a Firebase ID token and returns the decoded claims.
     *
     * @param token - The raw Firebase ID token string from the client.
     * @returns Decoded token data.
     * @throws If the token is invalid or expired.
     */
    verifyToken(token: string): Promise<DecodedToken>;
}
//# sourceMappingURL=firebase-token-verifier.d.ts.map