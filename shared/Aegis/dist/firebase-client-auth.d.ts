import type { IAuthUser, IClientAuth, AuthStateListener } from './interfaces/client-auth.js';
/**
 * Options for initialising the {@link FirebaseClientAuth}.
 *
 * These are intentionally named generically so that consuming code never needs
 * to reference Firebase-specific terminology.
 */
export interface FirebaseClientAuthOptions {
    /** Firebase Web API key (corresponds to `VITE_FIREBASE_API_KEY`). */
    readonly apiKey: string;
    /** Firebase Auth domain (corresponds to `VITE_FIREBASE_AUTH_DOMAIN`). */
    readonly authDomain: string;
    /** Firebase / Google Cloud project identifier. */
    readonly projectId: string;
    /**
     * Optional Firebase Auth emulator host or URL.
     *
     * Examples:
     * - `localhost:9099`
     * - `http://localhost:9099`
     */
    readonly authEmulatorHost?: string;
}
/**
 * Firebase client SDK implementation of {@link IClientAuth}.
 *
 * Wraps all `firebase/auth` interactions so that consuming code (e.g. the
 * frontend `AuthContext`) never needs to import `firebase/auth` directly.
 *
 * The underlying Firebase app is initialised lazily on construction: if an
 * app has already been initialised it is reused rather than creating a second
 * instance.
 *
 * @example
 * ```typescript
 * import { FirebaseClientAuth } from '@elastic-resume-base/aegis/client';
 *
 * const clientAuth = new FirebaseClientAuth({
 *   apiKey:     'my-api-key',
 *   authDomain: 'my-app.firebaseapp.com',
 *   projectId:  'my-project',
 * });
 *
 * clientAuth.onAuthStateChanged((user) => {
 *   console.log(user ? `Signed in as ${user.email}` : 'Signed out');
 * });
 * ```
 */
export declare class FirebaseClientAuth implements IClientAuth {
    private readonly auth;
    constructor(options: FirebaseClientAuthOptions);
    onAuthStateChanged(listener: AuthStateListener): () => void;
    signInWithEmailAndPassword(email: string, password: string): Promise<void>;
    signInWithGoogle(): Promise<void>;
    signOut(): Promise<void>;
    getCurrentUser(): IAuthUser | null;
    sendPasswordResetEmail(email: string): Promise<void>;
}
//# sourceMappingURL=firebase-client-auth.d.ts.map