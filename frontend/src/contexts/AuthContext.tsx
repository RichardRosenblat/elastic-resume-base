/**
 * @file AuthContext — Firebase Auth state and BFF user-profile context.
 *
 * Wraps the entire application so that any component can call
 * {@link useAuth} to read the current user and trigger auth actions.
 *
 * Auth flow:
 * 1. Firebase `onAuthStateChanged` fires whenever the session changes.
 * 2. On sign-in, the ID token is exchanged for a full user profile via
 *    `GET /api/v1/me` on the BFF Gateway.
 * 3. `userProfile.enable === false` means the account is pending approval —
 *    the `ProtectedRoute` component gates access in that case.
 * 4. `isAdmin` is `true` when `userProfile.role === 'admin'`.
 */
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
} from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import type { UserProfile } from '../types';
import { config } from '../config';

/**
 * Shape of the value provided by {@link AuthContext} / consumed by
 * {@link useAuth}.
 */
interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  isAdmin: boolean;
  getToken: () => Promise<string>;
}

const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Returns the auth context value. Must be called inside an
 * {@link AuthProvider} tree; throws otherwise.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

async function fetchUserProfile(token: string): Promise<UserProfile> {
  const response = await fetch(`${config.bffUrl}/api/v1/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch profile: ${response.status}`);
  }
  return response.json() as Promise<UserProfile>;
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides Firebase Auth state and BFF user-profile data to the component
 * tree. Place this near the root of the application (inside `ThemeProvider`
 * and `BrowserRouter` so that hooks and routing work correctly).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async (): Promise<string> => {
    if (!currentUser) throw new Error('No authenticated user');
    return currentUser.getIdToken();
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          const profile = await fetchUserProfile(token);
          setUserProfile(profile);
        } catch {
          setUserProfile(null);
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const loginWithGoogle = async (): Promise<void> => {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  };

  const logout = async (): Promise<void> => {
    await signOut(auth);
    setUserProfile(null);
  };

  const isAdmin = userProfile?.role === 'admin';

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    loginWithGoogle,
    logout,
    isAdmin,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
