/**
 * @file AuthContext — Aegis client auth state and Gateway user-profile context.
 *
 * Wraps the entire application so that any component can call
 * {@link useAuth} to read the current user and trigger auth actions.
 *
 * Auth flow:
 * 1. Aegis `onAuthStateChanged` fires whenever the session changes.
 * 2. On sign-in, the ID token is exchanged for a full user profile via
 *    `GET /api/v1/users/me` on the Gateway API. `loading` is set to `true`
 *    for the duration of this fetch so that LoginPage shows a spinner and
 *    does not redirect or flash the form prematurely.
 * 3. If the profile fetch returns 403 FORBIDDEN with "pending approval", the
 *    user is left authenticated in Firebase but `userProfile.enable` is set
 *    to `false` — the `ProtectedRoute` component gates access in that case.
 * 4. If the profile fetch returns 403 FORBIDDEN for any other reason (the
 *    user has no application access), Firebase sign-out is called immediately
 *    so that the session is cleared, a toast is shown, and the user stays on
 *    the login page.
 * 5. `isAdmin` is `true` when `userProfile.role === 'admin'`.
 */
import { useEffect, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';
import { useTranslation } from 'react-i18next';
import type { IAuthUser } from '@elastic-resume-base/aegis/client';
import { auth } from '../firebase';
import type { UserProfile, SuccessResponse } from '../types';
import { config } from '../config';
import { AuthContext } from './auth-context';
import type { AuthContextType } from './auth-context';
import { useToast } from './use-toast';
import { ensureApiRequestError, isRateLimitError, toUserFacingErrorMessage } from '../services/api-error';

async function fetchUserProfile(token: string): Promise<UserProfile> {
  const response = await axios.get<SuccessResponse<UserProfile>>(
    `${config.gatewayApiUrl}/api/v1/users/me`,
    { headers: { Authorization: `Bearer ${token}`, 'x-correlation-id': crypto.randomUUID() } },
  );
  return response.data.data;
}

interface AuthProviderProps {
  children: ReactNode;
}

/**
 * Provides Aegis client auth state and Gateway API user-profile data to the component
 * tree. Place this near the root of the application (inside `ThemeProvider`
 * and `BrowserRouter` so that hooks and routing work correctly).
 */
export function AuthProvider({ children }: AuthProviderProps) {
  const { showToast } = useToast();
  const { t } = useTranslation();
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
        // Keep the loading spinner visible while the profile is being fetched so that
        // LoginPage does not flash the login form or redirect prematurely.
        setLoading(true);
        try {
          const token = await user.getIdToken();
          const profile = await fetchUserProfile(token);
          setUserProfile(profile);
        } catch (error) {
          const normalizedError = ensureApiRequestError(error, 'Failed to fetch profile');

          // Log for developer debugging.
          console.error('[AuthContext ApiRequestError]', {
            code: normalizedError.code,
            status: normalizedError.status,
            message: normalizedError.message,
            correlationId: normalizedError.correlationId,
          });

          const isPendingApproval = normalizedError.status === 403
            && normalizedError.code === 'FORBIDDEN'
            && normalizedError.message.toLowerCase().includes('pending approval');

          if (isPendingApproval) {
            setUserProfile({
              uid: user.uid,
              email: user.email ?? '',
              name: user.displayName ?? undefined,
              picture: user.photoURL ?? undefined,
              role: 'user',
              enable: false,
            });
          } else if (isRateLimitError(normalizedError)) {
            // A transient rate-limit on the profile fetch must not sign the user
            // out — it's a recoverable condition. Keep the existing session and
            // profile state unchanged; the global rate-limit notifier will already
            // have shown a warning toast.
          } else {
            // User is authenticated with Firebase but has no application access.
            // Sign them out so the Firebase session is cleared and they stay on the
            // login page rather than being redirected to the dashboard.
            await auth.signOut();
            setUserProfile(null);
            showToast(toUserFacingErrorMessage(normalizedError, 'Failed to fetch profile', t), { severity: 'error' });
          }
        }
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [showToast, t]);

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

  const sendPasswordResetEmail = async (email: string): Promise<void> => {
    await auth.sendPasswordResetEmail(email);
  };

  const isAdmin = userProfile?.role === 'admin';

  const value: AuthContextType = {
    currentUser,
    userProfile,
    loading,
    login,
    loginWithGoogle,
    logout,
    sendPasswordResetEmail,
    isAdmin,
    getToken,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
