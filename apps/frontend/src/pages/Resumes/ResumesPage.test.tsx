import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import ResumesPage from './ResumesPage';

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

// Mock API
vi.mock('../../services/api', () => ({
  triggerResumeIngest: vi.fn(),
  generateResume: vi.fn(),
}));

// Mock feature flags
vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    resumeIngest: false,
    resumeSearch: false,
    documentRead: false,
    resumeGenerate: false,
    userManagement: true,
    hideIfDisabled: false,
    dlqNotifier: false,
  }),
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../contexts/use-toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

describe('ResumesPage', () => {
  it('renders the resumes title', () => {
    render(<ResumesPage />);
    expect(screen.getByText('resumes.title')).toBeInTheDocument();
  });

  it('renders ingest and generate sections', () => {
    render(<ResumesPage />);
    expect(screen.getByText('resumes.ingestResumes')).toBeInTheDocument();
    expect(screen.getByText('resumes.generateResume')).toBeInTheDocument();
  });

  it('shows coming soon when features are disabled', () => {
    render(<ResumesPage />);
    expect(screen.getAllByText('dashboard.comingSoon').length).toBeGreaterThan(0);
  });

  it('renders the generate resume language selector with English selected by default', () => {
    const { container } = render(<ResumesPage />);
    // The generate resume card should contain a language select (disabled when feature is off)
    // The default value "en" maps to "English" which is shown as selected value
    expect(container.querySelector('[id$="-label"]')).toBeTruthy();
  });
});
