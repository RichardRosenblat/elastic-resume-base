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

const adminAuthState = {
  ...defaultAuthState,
  isAdmin: true,
  userProfile: {
    ...defaultAuthState.userProfile,
    role: 'admin',
  },
};

// Use vi.hoisted so the mock factory can reference the mutable spy correctly.
const { mockUseAuth } = vi.hoisted(() => ({ mockUseAuth: vi.fn() }));
const { mockUseFeatureFlags } = vi.hoisted(() => ({ mockUseFeatureFlags: vi.fn() }));

vi.mock('../../contexts/auth-context', () => ({
  useAuth: mockUseAuth,
}));

// Mock feature flags
vi.mock('../../hooks/useFeatureFlags', () => ({
  useFeatureFlags: mockUseFeatureFlags,
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// Default theme mock — no dashboard or sidebar ordering, hideIfDisabled off.
const defaultTheme = {
  mode: 'light' as const,
  branding: { appName: 'Test', companyName: 'Test', appLogoUrl: '', companyLogoUrl: '' },
  typography: { fontFamily: 'sans-serif' },
  icons: { default: 'mdi:home' },
  palette: {
    primary: { main: '#000' },
    secondary: { main: '#000' },
    success: { main: '#000' },
    warning: { main: '#000' },
    error: { main: '#000' },
    info: { main: '#000' },
    background: { default: '#fff', paper: '#fff' },
    text: { primary: '#000', secondary: '#666' },
  },
};

// Mock useAppTheme
const { mockUseAppTheme } = vi.hoisted(() => ({ mockUseAppTheme: vi.fn() }));
vi.mock('../../theme', () => ({
  useAppTheme: mockUseAppTheme,
}));

const defaultFeatureFlags = {
  resumeIngest: false,
  resumeSearch: false,
  documentRead: false,
  resumeGenerate: false,
  userManagement: true,
  hideIfDisabled: false,
  dlqNotifier: false,
};

describe('DashboardPage', () => {
  beforeEach(() => {
    mockUseAuth.mockReturnValue(defaultAuthState);
    mockUseFeatureFlags.mockReturnValue(defaultFeatureFlags);
    mockUseAppTheme.mockReturnValue({ theme: defaultTheme, mode: 'light', toggleTheme: vi.fn() });
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

  it('shows the full email address in the profile card', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText('test@example.com')).toBeInTheDocument();
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
    // The profile card "Email:" field shows the full email address
    expect(screen.getByText('noname@example.com')).toBeInTheDocument();
  });

  it('renders the System Status feature card for all users', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText('nav.systemStatus')).toBeInTheDocument();
  });

  it('does not render the Users card for non-admin users', () => {
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.queryByText('nav.users')).not.toBeInTheDocument();
  });

  it('renders the Users card only for admin users', () => {
    mockUseAuth.mockReturnValue(adminAuthState);
    render(<MemoryRouter><DashboardPage /></MemoryRouter>);
    expect(screen.getByText('nav.users')).toBeInTheDocument();
  });

  describe('hide-if-disabled', () => {
    it('shows disabled feature cards (as "coming soon") when hideIfDisabled is false', () => {
      render(<MemoryRouter><DashboardPage /></MemoryRouter>);
      // resumeIngest is false, but with hideIfDisabled=false the card should still appear
      expect(screen.getByText('nav.resumes')).toBeInTheDocument();
    });

    it('hides disabled feature cards when hideIfDisabled is true', () => {
      mockUseFeatureFlags.mockReturnValue({ ...defaultFeatureFlags, hideIfDisabled: true });
      render(<MemoryRouter><DashboardPage /></MemoryRouter>);
      // resumeIngest, resumeSearch, documentRead are all false → hidden
      expect(screen.queryByText('nav.resumes')).not.toBeInTheDocument();
      expect(screen.queryByText('nav.search')).not.toBeInTheDocument();
      expect(screen.queryByText('nav.documents')).not.toBeInTheDocument();
      // system-status is always available → shown
      expect(screen.getByText('nav.systemStatus')).toBeInTheDocument();
    });

    it('keeps enabled feature cards visible when hideIfDisabled is true', () => {
      mockUseFeatureFlags.mockReturnValue({
        ...defaultFeatureFlags,
        documentRead: true,
        hideIfDisabled: true,
      });
      render(<MemoryRouter><DashboardPage /></MemoryRouter>);
      expect(screen.getByText('nav.documents')).toBeInTheDocument();
    });
  });

  describe('feature card ordering', () => {
    it('uses sidebar item order from theme as default', () => {
      const themeWithSidebarOrder = {
        ...defaultTheme,
        sidebar: {
          items: [
            { path: '/system-status', order: 1 },
            { path: '/documents', order: 2 },
            { path: '/resumes', order: 3 },
          ],
        },
      };
      mockUseAppTheme.mockReturnValue({ theme: themeWithSidebarOrder, mode: 'light', toggleTheme: vi.fn() });
      mockUseFeatureFlags.mockReturnValue({ ...defaultFeatureFlags, documentRead: true, resumeIngest: true });

      render(<MemoryRouter><DashboardPage /></MemoryRouter>);

      const cards = screen.getAllByRole('heading', { level: 6 });
      const cardTitles = cards.map((c) => c.textContent);
      const systemStatusIdx = cardTitles.indexOf('nav.systemStatus');
      const documentsIdx = cardTitles.indexOf('nav.documents');
      const resumesIdx = cardTitles.indexOf('nav.resumes');

      expect(systemStatusIdx).toBeLessThan(documentsIdx);
      expect(documentsIdx).toBeLessThan(resumesIdx);
    });

    it('uses dashboard-specific item order when dashboard.items is set', () => {
      const themeWithDashboardOverride = {
        ...defaultTheme,
        sidebar: {
          items: [
            { path: '/resumes', order: 1 },
            { path: '/documents', order: 2 },
            { path: '/system-status', order: 3 },
          ],
        },
        dashboard: {
          items: [
            { path: '/system-status', order: 1 },
            { path: '/resumes', order: 2 },
            { path: '/documents', order: 3 },
          ],
        },
      };
      mockUseAppTheme.mockReturnValue({ theme: themeWithDashboardOverride, mode: 'light', toggleTheme: vi.fn() });
      mockUseFeatureFlags.mockReturnValue({ ...defaultFeatureFlags, documentRead: true, resumeIngest: true });

      render(<MemoryRouter><DashboardPage /></MemoryRouter>);

      const cards = screen.getAllByRole('heading', { level: 6 });
      const cardTitles = cards.map((c) => c.textContent);
      const systemStatusIdx = cardTitles.indexOf('nav.systemStatus');
      const resumesIdx = cardTitles.indexOf('nav.resumes');
      const documentsIdx = cardTitles.indexOf('nav.documents');

      // Dashboard override puts system-status first, then resumes, then documents
      expect(systemStatusIdx).toBeLessThan(resumesIdx);
      expect(resumesIdx).toBeLessThan(documentsIdx);
    });
  });
});
