import admin from 'firebase-admin';
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
export class FirebaseTokenVerifier implements ITokenVerifier {
  private readonly app: admin.app.App;

  constructor(options: FirebaseAuthOptions) {
    if (admin.apps.length > 0) {
      this.app = admin.apps[0]!;
    } else {
      const appOptions: admin.AppOptions = { projectId: options.projectId };

      if (options.serviceAccountKey) {
        try {
          const raw = options.serviceAccountKey.trim();
          const decoded = raw.startsWith('{')
            ? raw
            : Buffer.from(raw, 'base64').toString('utf-8');
          const credentials = JSON.parse(decoded) as admin.ServiceAccount;
          appOptions.credential = admin.credential.cert(credentials);
        } catch {
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
  async verifyToken(token: string): Promise<DecodedToken> {
    const decoded = await admin.auth(this.app).verifyIdToken(token);
    return {
      uid: decoded.uid,
      email: decoded.email,
      name: decoded.name as string | undefined,
      picture: decoded.picture,
    };
  }
}
