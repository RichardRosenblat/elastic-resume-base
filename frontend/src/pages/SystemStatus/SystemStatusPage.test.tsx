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

  it('renders service status cards on success', async () => {
    mockGetDownstreamHealth.mockResolvedValue({
      downstream: {
        usersApi: { status: 'ok' },
        downloader: { status: 'degraded' },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.getByText('usersApi')).toBeInTheDocument();
      expect(screen.getByText('downloader')).toBeInTheDocument();
    });

    // 'ok' service shows ok label, degraded service shows degraded label
    expect(screen.getByText('systemStatus.statusOk')).toBeInTheDocument();
    expect(screen.getByText('systemStatus.statusDegraded')).toBeInTheDocument();
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
        usersApi: { status: 'ok' },
      },
    });

    render(<MemoryRouter><SystemStatusPage /></MemoryRouter>);

    await waitFor(() => {
      expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });
  });
});
