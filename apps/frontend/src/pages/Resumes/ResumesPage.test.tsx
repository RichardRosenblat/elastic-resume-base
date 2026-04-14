import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
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
  triggerResumeIngestUpload: vi.fn(),
  triggerResumeIngestDriveLink: vi.fn(),
  triggerResumeIngestSingleFile: vi.fn(),
}));

// Mock feature flags
vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: () => ({
    resumeIngest: true,
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
    t: (key: string, opts?: Record<string, unknown>) => {
      if (opts && 'count' in opts) return `${key}:${String(opts.count)}`;
      return key;
    },
    i18n: { language: 'en', changeLanguage: vi.fn() },
  }),
}));

vi.mock('../../contexts/use-toast', () => ({
  useToast: () => ({
    showToast: vi.fn(),
  }),
}));

vi.mock('../../hooks/useShowApiError', () => ({
  useShowApiError: () => vi.fn(),
}));

describe('ResumesPage', () => {
  it('renders the resumes title', () => {
    render(<ResumesPage />);
    expect(screen.getByText('resumes.title')).toBeInTheDocument();
  });

  it('renders ingest section', () => {
    render(<ResumesPage />);
    expect(screen.getByText('resumes.ingestResumes')).toBeInTheDocument();
    expect(screen.queryByText('resumes.generateResume')).not.toBeInTheDocument();
  });

  it('does not show coming soon when ingest is enabled', () => {
    render(<ResumesPage />);
    expect(screen.queryByText('dashboard.comingSoon')).not.toBeInTheDocument();
  });

  it('shows ingestion error details table after spreadsheet ingest with errors', async () => {
    const { triggerResumeIngest } = await import('../../services/api');
    vi.mocked(triggerResumeIngest).mockResolvedValueOnce({
      ingested: 2,
      errors: [
        { row: 3, error: 'Invalid Drive link' },
        { row: 7, error: 'File not found' },
      ],
      duplicates: [],
    });

    render(<ResumesPage />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'my-sheet-id');

    const submitBtn = screen.getByRole('button', { name: 'resumes.submit' });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText('resumes.ingestErrorDetails')).toBeInTheDocument();
    });

    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText('Invalid Drive link')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('File not found')).toBeInTheDocument();
  });

  it('does not show error details table after spreadsheet ingest without errors', async () => {
    const { triggerResumeIngest } = await import('../../services/api');
    vi.mocked(triggerResumeIngest).mockResolvedValueOnce({
      ingested: 5,
      errors: [],
      duplicates: [],
    });

    render(<ResumesPage />);

    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'my-sheet-id');

    const submitBtn = screen.getByRole('button', { name: 'resumes.submit' });
    await userEvent.click(submitBtn);

    await waitFor(() => {
      expect(screen.getByText(/resumes.ingestedCount/)).toBeInTheDocument();
    });

    expect(screen.queryByText('resumes.ingestErrorDetails')).not.toBeInTheDocument();
  });
});
