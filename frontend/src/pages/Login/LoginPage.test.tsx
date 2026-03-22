import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { ReactNode } from 'react';
import { BrowserRouter } from 'react-router-dom';
import LoginPage from './LoginPage';

// Mock Firebase
vi.mock('../../firebase', () => ({
  auth: { currentUser: null },
}));

// Mock AuthContext
const mockLogin = vi.fn();
const mockLoginWithGoogle = vi.fn();

vi.mock('../../contexts/AuthContext', () => ({
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

// Mock config
vi.mock('../../config', () => ({
  config: {
    appName: 'Test App',
    bffUrl: 'http://localhost:3000',
    primaryColor: '#1976d2',
    secondaryColor: '#9c27b0',
    logoUrl: null,
    firebase: { apiKey: '', authDomain: '', projectId: 'test' },
    features: {
      resumeIngest: false,
      resumeSearch: false,
      documentRead: false,
      resumeGenerate: false,
      userManagement: true,
    },
  },
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
