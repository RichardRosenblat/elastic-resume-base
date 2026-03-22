import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import DashboardPage from './DashboardPage';

// Mock AuthContext
vi.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({
    currentUser: { uid: 'test-uid', email: 'test@example.com' },
    userProfile: {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      role: 'user',
      enable: true,
    },
    loading: false,
    isAdmin: false,
  }),
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
  it('renders welcome message with user name', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/dashboard.welcome/)).toBeInTheDocument();
    expect(screen.getByText(/Test User/)).toBeInTheDocument();
  });

  it('renders profile card', () => {
    render(<DashboardPage />);
    expect(screen.getByText('dashboard.yourProfile')).toBeInTheDocument();
  });

  it('shows user email', () => {
    render(<DashboardPage />);
    expect(screen.getByText(/test@example.com/)).toBeInTheDocument();
  });
});
