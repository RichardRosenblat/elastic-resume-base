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

// Mock AuthContext
const mockLogin = vi.fn();
const mockLoginWithGoogle = vi.fn();

vi.mock('../../contexts/auth-context', () => ({
  useAuth: () => ({
    currentUser: null,
    userProfile: null,
    loading: false,
    login: mockLogin,
    loginWithGoogle: mockLoginWithGoogle,
    logout: vi.fn(),
    isAdmin: false,
    getToken: vi.fn(),
  }),
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
      branding: { companyName: 'Test App', logoUrl: '' },
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
  });

  it('renders login form', () => {
    render(
      <BrowserRouter>
        <LoginPage />
      </BrowserRouter>
    );
    expect(screen.getByText('Test App')).toBeInTheDocument();
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
});
