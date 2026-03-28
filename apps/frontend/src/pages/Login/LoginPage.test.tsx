import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

// Mock Aegis firebase initialisation (prevents real Firebase SDK from being called in tests)
vi.mock('../../firebase', () => ({
  auth: {
    getCurrentUser: () => null,
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
    signInWithEmailAndPassword: vi.fn(),
    signInWithGoogle: vi.fn(),
  },
  default: {
    getCurrentUser: () => null,
    signOut: vi.fn(),
    onAuthStateChanged: vi.fn(() => () => {}),
    signInWithEmailAndPassword: vi.fn(),
    signInWithGoogle: vi.fn(),
  },
}));

// Mutable auth state — reset to defaults in beforeEach so tests are isolated.
const mockAuthState = vi.hoisted(() => ({
  currentUser: null as object | null,
  userProfile: null as object | null,
  loading: false,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  sendPasswordResetEmail: vi.fn(),
  isAdmin: false,
  getToken: vi.fn(),
}));

vi.mock('../../contexts/auth-context', () => ({
  useAuth: () => mockAuthState,
  AuthProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

// Mock theme
vi.mock('../../theme', () => ({
  useAppTheme: () => ({
    theme: {
      branding: {
        appName: 'Elastic Resume Base',
        companyName: 'Test Company',
        appLogoUrl: '',
        companyLogoUrl: '',
      },
      palette: {
        primary: { main: '#2563EB' },
        secondary: { main: '#F97316' },
        success: { main: '#22C55E' },
        warning: { main: '#F97316' },
        error: { main: '#EF4444' },
        info: { main: '#38BDF8' },
        background: { default: '#0F172A', paper: '#1E293B' },
        text: { primary: '#F8FAFC', secondary: '#94A3B8' },
      },
      typography: { fontFamily: 'Roboto, sans-serif' },
      icons: { default: 'mdi:home' },
      mode: 'dark',
    },
    mode: 'dark',
    toggleTheme: vi.fn(),
  }),
  AppThemeProvider: ({ children }: { children: ReactNode }) => <>{children}</>,
}));

describe('LoginPage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset to unauthenticated, not-loading defaults.
    mockAuthState.currentUser = null;
    mockAuthState.userProfile = null;
    mockAuthState.loading = false;
  });

  it('renders login form', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByText('Elastic Resume Base')).toBeInTheDocument();
    expect(screen.getByText('Test Company')).toBeInTheDocument();
  });

  it('renders email and password fields', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByLabelText(/auth.email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/auth.password/i)).toBeInTheDocument();
  });

  it('renders Google sign-in button', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByText('auth.signInWithGoogle')).toBeInTheDocument();
  });

  it('shows a loading spinner instead of the login form while auth is loading', () => {
    mockAuthState.loading = true;
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    // The login form should NOT be visible while loading.
    expect(screen.queryByLabelText(/auth.email/i)).not.toBeInTheDocument();
    // LoadingSpinner renders a CircularProgress which has role="progressbar".
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('hides the login form when the user is already authenticated with a valid profile', () => {
    mockAuthState.currentUser = { uid: 'abc123' };
    mockAuthState.userProfile = { uid: 'abc123', email: 'a@b.com', role: 'user', enable: true };
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    // The form fields should not be rendered once authenticated.
    expect(screen.queryByLabelText(/auth.email/i)).not.toBeInTheDocument();
  });

  it('does NOT redirect when user is authenticated in Firebase but has no application profile', () => {
    // This covers the 403 FORBIDDEN case: Firebase auth succeeded but the user
    // has no access to the app. AuthContext clears the profile, so userProfile is null.
    mockAuthState.currentUser = { uid: 'abc123' };
    mockAuthState.userProfile = null;
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    // The login form must remain visible so the user can see the toast and try again.
    expect(screen.getByLabelText(/auth.email/i)).toBeInTheDocument();
  });
});
