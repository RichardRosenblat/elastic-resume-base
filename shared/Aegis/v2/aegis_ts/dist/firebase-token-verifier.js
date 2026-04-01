import admin from 'firebase-admin';
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
export class FirebaseTokenVerifier {
    app;
    /**
     * Creates a new {@link FirebaseTokenVerifier} instance.
     *
     * If a Firebase Admin app has already been initialised (e.g. by the Synapse
     * library), it is reused.  Otherwise, a new app is initialised using the
     * provided `projectId` and, when supplied, the `serviceAccountKey`.
     *
     * @param options - Firebase project and credentials configuration.
     */
    constructor(options) {
        if (admin.apps.length > 0) {
            this.app = admin.apps[0];
        }
        else {
            const appOptions = { projectId: options.projectId };
            if (options.serviceAccountKey) {
                try {
                    const raw = options.serviceAccountKey.trim();
                    const decoded = raw.startsWith('{')
                        ? raw
                        : Buffer.from(raw, 'base64').toString('utf-8');
                    const credentials = JSON.parse(decoded);
                    appOptions.credential = admin.credential.cert(credentials);
                }
                catch {
                    // Parsing failed — fall back to Application Default Credentials.
                }
            }
            this.app = admin.initializeApp(appOptions);
        }
    }
    /**
     * Verifies a Firebase ID token and returns the decoded claims.
     *
     * @param token - The raw Firebase ID token string from the client.
     * @returns Decoded token data.
     * @throws If the token is invalid or expired.
     */
    async verifyToken(token) {
        const decoded = await admin.auth(this.app).verifyIdToken(token);
        return {
            uid: decoded.uid,
            email: decoded.email,
            name: decoded.name,
            picture: decoded.picture,
        };
    }
}
//# sourceMappingURL=firebase-token-verifier.js.map