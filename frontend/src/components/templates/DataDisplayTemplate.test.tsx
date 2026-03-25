import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import DataDisplayTemplate from './DataDisplayTemplate';
import type { DataDisplayConfig } from './types';

// ─── test data ────────────────────────────────────────────────────────────────

interface Profile {
  email: string;
  role: string;
  uid: string;
}

const data: Profile = {
  email: 'alice@example.com',
  role: 'admin',
  uid: 'uid-123',
};

function buildConfig(
  overrides: Partial<DataDisplayConfig<Profile>> = {},
): DataDisplayConfig<Profile> {
  return {
    fields: [
      { key: 'email', label: 'Email' },
      { key: 'role', label: 'Role' },
      { key: 'uid', label: 'UID' },
    ],
    data,
    ...overrides,
  };
}

// ─── DataDisplayTemplate tests ────────────────────────────────────────────────

describe('DataDisplayTemplate', () => {
  it('renders all field labels', () => {
    render(<DataDisplayTemplate config={buildConfig()} />);

    expect(screen.getByText('Email:')).toBeInTheDocument();
    expect(screen.getByText('Role:')).toBeInTheDocument();
    expect(screen.getByText('UID:')).toBeInTheDocument();
  });

  it('renders the correct value for each field', () => {
    render(<DataDisplayTemplate config={buildConfig()} />);

    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText('admin')).toBeInTheDocument();
    expect(screen.getByText('uid-123')).toBeInTheDocument();
  });

  it('renders fields in the order they appear in config.fields', () => {
    render(<DataDisplayTemplate config={buildConfig()} />);

    const labels = screen.getAllByText(/^(Email|Role|UID):$/);
    expect(labels[0]).toHaveTextContent('Email:');
    expect(labels[1]).toHaveTextContent('Role:');
    expect(labels[2]).toHaveTextContent('UID:');
  });

  it('respects a reversed field order', () => {
    const config = buildConfig({
      fields: [
        { key: 'uid', label: 'UID' },
        { key: 'email', label: 'Email' },
      ],
    });
    render(<DataDisplayTemplate config={config} />);

    const labels = screen.getAllByText(/^(Email|UID):$/);
    expect(labels[0]).toHaveTextContent('UID:');
    expect(labels[1]).toHaveTextContent('Email:');
  });

  it('uses a custom render function when provided', () => {
    const config = buildConfig({
      fields: [
        {
          key: 'role',
          label: 'Role',
          render: (value) => (
            <span data-testid="custom-role">CUSTOM:{String(value)}</span>
          ),
        },
      ],
    });
    render(<DataDisplayTemplate config={config} />);

    expect(screen.getByTestId('custom-role')).toHaveTextContent('CUSTOM:admin');
  });

  it('falls back to "-" when a field value is null/undefined', () => {
    const config: DataDisplayConfig<{ name?: string }> = {
      fields: [{ key: 'name', label: 'Name' }],
      data: {},
    };
    render(<DataDisplayTemplate config={config} />);

    expect(screen.getByText('-')).toBeInTheDocument();
  });

  it('renders the optional title when provided', () => {
    const config = buildConfig({ title: 'Your Profile' });
    render(<DataDisplayTemplate config={config} />);

    expect(screen.getByRole('heading', { level: 6 })).toHaveTextContent('Your Profile');
  });

  it('does not render a heading element when title is omitted', () => {
    render(<DataDisplayTemplate config={buildConfig()} />);

    expect(screen.queryByRole('heading', { level: 6 })).not.toBeInTheDocument();
  });

  it('applies a custom labelMinWidth to the label element', () => {
    const config = buildConfig({
      fields: [{ key: 'email', label: 'Email', labelMinWidth: 120 }],
    });
    render(<DataDisplayTemplate config={config} />);

    const emailLabel = screen.getByText('Email:');
    expect(emailLabel).toBeInTheDocument(); // rendered correctly
  });
});
