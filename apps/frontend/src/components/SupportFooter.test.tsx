import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Top-level mocks (hoisted by Vitest — must precede the component import)
// ---------------------------------------------------------------------------

// Mock i18n — return the translation key as the display string so assertions
// are locale-independent.
vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
    i18n: { language: 'en' },
  }),
}));

// vi.hoisted ensures `mockConfig` is initialised before vi.mock's factory runs.
const mockConfig = vi.hoisted(() => ({ supportEmail: '' }));

// Mock the config module so we can control `supportEmail` per test.
vi.mock('../config', () => ({ config: mockConfig }));

// Import AFTER mocks are set up.
import SupportFooter from './SupportFooter';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('SupportFooter', () => {
  it('renders nothing when supportEmail is empty', () => {
    mockConfig.supportEmail = '';
    const { container } = render(<SupportFooter />);
    expect(container.firstChild).toBeNull();
  });

  it('renders footer text when supportEmail is set', () => {
    mockConfig.supportEmail = 'help@example.com';
    render(<SupportFooter />);
    expect(screen.getByText('support.notWorking')).toBeInTheDocument();
    expect(screen.getByText('support.contactSupport')).toBeInTheDocument();
  });

  it('renders a mailto link with the configured email address', () => {
    mockConfig.supportEmail = 'support@acme.com';
    render(<SupportFooter />);
    const link = screen.getByRole('link', { name: 'support.contactSupport' });
    expect(link).toHaveAttribute('href', 'mailto:support@acme.com');
  });
});
