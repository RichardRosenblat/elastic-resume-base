import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import DashboardPage from './DashboardPage';

// Default auth mock value — tests that need a different value can call
// mockAuthState() to override for a single render.
const defaultAuthState = {
  currentUser: { uid: 'test-uid', email: 'test@example.com' } as never,
  userProfile: {
    uid: 'test-uid',
    email: 'test@example.com',
    name: 'Test User',
    role: 'user',
    enable: true,
  },
  loading: false,
  isAdmin: false,
  login: vi.fn(),
  loginWithGoogle: vi.fn(),
  logout: vi.fn(),
  getToken: vi.fn(),
};

// Use vi.hoisted so the mock factory can reference the mutable spy correctly.
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));

vi.mock('../../contexts/auth-context', () => ({
  useAuth: mockUseAuth,
}));

// Mock feature flags
vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    resumeIngest: false,
    resumeSearch: false,
    documentRead: false,
    resumeGenerate: false,
    userManagement: true,
  }),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

describe('DashboardPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(defaultAuthState);
  });

  it('renders welcome message with user name', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(/dashboard.welcome/)).toBeInTheDocument();
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('renders profile card', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText('dashboard.yourProfile')).toBeInTheDocument();
  });

  it('shows only the username part of the email (before @) in the profile card', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText(/^test$/)).toBeInTheDocument();
    expect(screen.queryByText(/test@example\.com/)).not.toBeInTheDocument();
  });

  it('shows only the username part of the email (before @) in the welcome greeting when no name is set', () => {
    mockUseAuth.mockReturnValueOnce({
      ...defaultAuthState,
      userProfile: {
        uid: 'test-uid',
        email: 'noname@example.com',
        name: undefined,
        role: 'user',
        enable: true,
      },
    });

    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    // The welcome h5 heading should contain 'noname' but not the '@domain' part
    const heading = screen.getByRole('heading', { level: 5 });
    expect(heading.textContent).toContain('noname');
    expect(heading.textContent).not.toContain('@');
    // The profile "Email:" field should also show only the local part (before @)
    expect(screen.getByText('noname')).toBeInTheDocument();
    expect(screen.queryByText(/noname@example\.com/)).not.toBeInTheDocument();
  });
});
