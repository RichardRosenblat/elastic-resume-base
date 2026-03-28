import { createContext, useContext } from 'react';
import type { IAuthUser } from '@elastic-resume-base/aegis/client';
import type { UserProfile } from '../types';

/**
 * Shape of the value provided by AuthContext / consumed by useAuth.
 */
export interface AuthContextType {
  currentUser: IAuthUser | null;
  userProfile: UserProfile | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  sendPasswordResetEmail: (email: string) => Promise<void>;
  isAdmin: boolean;
  getToken: () => Promise<string>;
}

export const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Returns the auth context value. Must be called inside an AuthProvider tree.
 */
export function useAuth(): AuthContextType {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}