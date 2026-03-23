import {
  getApp,
  getApps,
  initializeApp,
} from 'firebase/app';
import {
  connectAuthEmulator,
  getAuth,
  onAuthStateChanged as fbOnAuthStateChanged,
  signInWithEmailAndPassword as fbSignInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as fbSignOut,
} from 'firebase/auth';
import type { Auth, User } from 'firebase/auth';
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
 * Adapter that wraps a Firebase {@link User} as an {@link IAuthUser}, hiding
 * any Firebase-specific API surface from consumers.
 */
class FirebaseAuthUser implements IAuthUser {
  constructor(private readonly user: User) {}

  get uid(): string {
    return this.user.uid;
  }

  get email(): string | null {
    return this.user.email;
  }

  get displayName(): string | null {
    return this.user.displayName;
  }

  get photoURL(): string | null {
    return this.user.photoURL;
  }

  getIdToken(): Promise<string> {
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
export class FirebaseClientAuth implements IClientAuth {
  private readonly auth: Auth;

  constructor(options: FirebaseClientAuthOptions) {
    const app = getApps().length > 0 ? getApp() : initializeApp(options);
    this.auth = getAuth(app);

    const authEmulatorHost = options.authEmulatorHost?.trim();
    if (authEmulatorHost) {
      const emulatorUrl =
        authEmulatorHost.startsWith('http://') || authEmulatorHost.startsWith('https://')
          ? authEmulatorHost
          : `http://${authEmulatorHost}`;
      connectAuthEmulator(this.auth, emulatorUrl, { disableWarnings: true });
    }
  }

  onAuthStateChanged(listener: AuthStateListener): () => void {
    return fbOnAuthStateChanged(this.auth, (user: User | null) => {
      void listener(user !== null ? new FirebaseAuthUser(user) : null);
    });
  }

  async signInWithEmailAndPassword(email: string, password: string): Promise<void> {
    await fbSignInWithEmailAndPassword(this.auth, email, password);
  }

  async signInWithGoogle(): Promise<void> {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(this.auth, provider);
  }

  async signOut(): Promise<void> {
    await fbSignOut(this.auth);
  }

  getCurrentUser(): IAuthUser | null {
    const user = this.auth.currentUser;
    return user !== null ? new FirebaseAuthUser(user) : null;
  }
}
