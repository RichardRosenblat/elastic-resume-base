import { getApp, getApps, initializeApp, } from 'firebase/app';
import { connectAuthEmulator, getAuth, onAuthStateChanged as fbOnAuthStateChanged, signInWithEmailAndPassword as fbSignInWithEmailAndPassword, signInWithPopup, GoogleAuthProvider, signOut as fbSignOut, sendPasswordResetEmail as fbSendPasswordResetEmail, } from 'firebase/auth';
/**
 * Adapter that wraps a Firebase {@link User} as an {@link IAuthUser}, hiding
 * any Firebase-specific API surface from consumers.
 */
class FirebaseAuthUser {
    user;
    constructor(user) {
        this.user = user;
    }
    get uid() {
        return this.user.uid;
    }
    get email() {
        return this.user.email;
    }
    get displayName() {
        return this.user.displayName;
    }
    get photoURL() {
        return this.user.photoURL;
    }
    getIdToken() {
        return this.user.getIdToken();
    }
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
export class FirebaseClientAuth {
    auth;
    constructor(options) {
        const app = getApps().length > 0 ? getApp() : initializeApp(options);
        this.auth = getAuth(app);
        const authEmulatorHost = options.authEmulatorHost?.trim();
        if (authEmulatorHost) {
            const emulatorUrl = authEmulatorHost.startsWith('http://') || authEmulatorHost.startsWith('https://')
                ? authEmulatorHost
                : `http://${authEmulatorHost}`;
            connectAuthEmulator(this.auth, emulatorUrl, { disableWarnings: true });
        }
    }
    onAuthStateChanged(listener) {
        return fbOnAuthStateChanged(this.auth, (user) => {
            void listener(user !== null ? new FirebaseAuthUser(user) : null);
        });
    }
    async signInWithEmailAndPassword(email, password) {
        await fbSignInWithEmailAndPassword(this.auth, email, password);
    }
    async signInWithGoogle() {
        const provider = new GoogleAuthProvider();
        await signInWithPopup(this.auth, provider);
    }
    async signOut() {
        await fbSignOut(this.auth);
    }
    getCurrentUser() {
        const user = this.auth.currentUser;
        return user !== null ? new FirebaseAuthUser(user) : null;
    }
    async sendPasswordResetEmail(email) {
        await fbSendPasswordResetEmail(this.auth, email);
    }
}
//# sourceMappingURL=firebase-client-auth.js.map