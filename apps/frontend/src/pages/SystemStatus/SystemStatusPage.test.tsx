import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import SystemStatusPage from './SystemStatusPage';

// Use vi.hoisted so the mock factory can reference the mutable spy correctly.
const { mockGetDownstreamHealth } = vi.hoisted(() => ({
  mockGetDownstreamHealth: vi.fn(),
}));

// Mock API
vi.mock('../../services/api', () => ({
  getDownstreamHealth: mockGetDownstreamHealth,
}));

// Mock i18n
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

const now = new Date().toISOString();
const recentTime = new Date(Date.now() - 1000).toISOString(); // 1 s ago → warm
const oldTime = new Date(Date.now() - 600_000).toISOString();  // 10 min ago → cold

describe('SystemStatusPage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows a loading spinner while fetching', () => {
    // Never resolves during this test
    mockGetDownstreamHealth.mockReturnValue(new Promise(() => {}));
    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);
    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('renders service status cards with live/temperature data on success', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        usersApi: { live: true, temperature: 'warm', lastSeenAlive: recentTime, lastChecked: now },
        downloader: { live: false, temperature: 'cold', lastSeenAlive: null, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      // Technical names are shown verbatim (not translated)
      expect(screen.getByText('users-api')).toBeInTheDocument();
      expect(screen.getByText('downloader')).toBeInTheDocument();
    });

    // Friendly names are rendered via i18n (mock returns the key)
    expect(screen.getByText('systemStatus.services.usersApi.name')).toBeInTheDocument();
    expect(screen.getByText('systemStatus.services.downloader.name')).toBeInTheDocument();

    // Status chips — usersApi is warm/live → Ready; downloader is not live → Unavailable
    expect(screen.getByText('systemStatus.statusReady')).toBeInTheDocument();
    expect(screen.getByText('systemStatus.statusUnavailable')).toBeInTheDocument();
  });

  it('renders idle chip for cold-but-live service', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        searchBase: { live: true, temperature: 'cold', lastSeenAlive: oldTime, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('systemStatus.statusIdle')).toBeInTheDocument();
    });
  });

  it('shows idleMessage (not impact) for idle services', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        searchBase: { live: true, temperature: 'cold', lastSeenAlive: oldTime, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('systemStatus.idleMessage')).toBeInTheDocument();
      expect(screen.queryByText('systemStatus.services.searchBase.impact')).not.toBeInTheDocument();
    });
  });

  it('shows impact message (not idleMessage) for unavailable services', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        searchBase: { live: false, temperature: 'cold', lastSeenAlive: null, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('systemStatus.services.searchBase.impact')).toBeInTheDocument();
      expect(screen.queryByText('systemStatus.idleMessage')).not.toBeInTheDocument();
    });
  });

  it('shows the page title', () => {
    mockGetDownstreamHealth.mockResolvedValue({ downstream: {} });
    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);
    expect(screen.getByText('systemStatus.title')).toBeInTheDocument();
  });

  it('displays an unavailable message when the endpoint is unreachable', async () => {
    mockGetDownstreamHealth.mockRejectedValue(new Error('Network Error'));

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('systemStatus.unavailable')).toBeInTheDocument();
    });
  });

  it('does not show a spinner after data loads', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        usersApi: { live: true, temperature: 'warm', lastSeenAlive: recentTime, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });

  it('shows lastSeenAlive and lastChecked labels', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        usersApi: { live: true, temperature: 'warm', lastSeenAlive: recentTime, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/systemStatus\.lastSeenLabel/)).toBeInTheDocument();
      expect(screen.getByText(/systemStatus\.lastCheckedLabel/)).toBeInTheDocument();
    });
  });

  it('shows "neverSeen" when lastSeenAlive is null', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        downloader: { live: false, temperature: 'cold', lastSeenAlive: null, lastChecked: now },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText(/systemStatus\.neverSeen/)).toBeInTheDocument();
    });
  });
});
