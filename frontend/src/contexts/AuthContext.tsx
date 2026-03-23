/**
 * @file AuthContext — Aegis client auth state and BFF user-profile context.
 *
 * Wraps the entire application so that any component can call
 * {@link useAuth} to read the current user and trigger auth actions.
 *
 * Auth flow:
 * 1. Aegis `onAuthStateChanged` fires whenever the session changes.
 * 2. On sign-in, the ID token is exchanged for a full user profile via
 *    `GET /api/v1/users/me` on the BFF Gateway.
 * 3. `userProfile.enable === false` means the account is pending approval —
 *    the `ProtectedRoute` component gates access in that case.
 * 4. `isAdmin` is `true` when `userProfile.role === 'admin'`.
 */
import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { IAuthUser } from '@elastic-resume-base/aegis/client';
import { auth } from '../firebase';
import type { UserProfile } from '../types';
import { config } from '../config';
import { AuthContext } from './auth-context';
import type { AuthContextType } from './auth-context';
import { useToast } from './use-toast';
import { throwOnFailedResponse, toUserFacingErrorMessage } from '../services/api-error';

async function fetchUserProfile(token: string): Promise<UserProfile> {
  const response = await fetch(`${config.bffUrl}/api/v1/users/me`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  await throwOnFailedResponse(response, 'Failed to fetch profile');
  const profileResponse = await response.json();
  return profileResponse.data as UserProfile;
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides Aegis client auth state and BFF user-profile data to the component
 * tree. Place this near the root of the application (inside `ThemeProvider`
 * and `BrowserRouter` so that hooks and routing work correctly).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { showToast } = useToast();
  const [currentUser, setCurrentUser] = useState<IAuthUser | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const getToken = useCallback(async (): Promise<string> => {
    if (!currentUser) throw new Error('No authenticated user');
    return currentUser.getIdToken();
  }, [currentUser]);

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      setCurrentUser(user);
      if (user) {
        try {
          const token = await user.getIdToken();
          const profile = await fetchUserProfile(token);
          setUserProfile(profile);
        } catch (error) {
          setUserProfile(null);
          showToast(toUserFacingErrorMessage(error, 'Failed to fetch profile'), { severity: 'error' });
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [showToast]);

  const login = async (email: string, password: string): Promise<void> => {
    await auth.signInWithEmailAndPassword(email, password);
  };

  const loginWithGoogle = async (): Promise<void> => {
    await auth.signInWithGoogle();
  };

  const logout = async (): Promise<void> => {
    await auth.signOut();
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
