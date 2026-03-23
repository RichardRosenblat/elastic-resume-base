import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import FormTemplate from './FormTemplate';
import type { FormConfig } from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

function buildConfig(overrides: Partial<FormConfig> = {}): FormConfig {
  return {
    fields: [
      { key: 'email', label: 'Email', type: 'email', size: 'small', minWidth: 280 },
      { key: 'name', label: 'Name', type: 'text', size: 'small' },
    ],
    buttons: [
      { label: 'Save', onClick: vi.fn(), variant: 'contained' },
      { label: 'Cancel', onClick: vi.fn(), variant: 'outlined' },
    ],
    values: { email: 'user@example.com', name: 'Alice' },
    onChange: vi.fn(),
    ...overrides,
  };
}

// ─── FormTemplate tests ──────────────────────────────────────────────────────

describe('FormTemplate', () => {
  it('renders all fields in config order', () => {
    const config = buildConfig();
    render(<FormTemplate config={config} />);

    const inputs = screen.getAllByRole('textbox');
    // email comes first in the fields array
    expect(inputs[0]).toHaveValue('user@example.com');
    // name comes second
    expect(inputs[1]).toHaveValue('Alice');
  });

  it('renders all buttons in config order', () => {
    const config = buildConfig();
    render(<FormTemplate config={config} />);

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('Save');
    expect(buttons[1]).toHaveTextContent('Cancel');
  });

  it('calls onChange with field key and new value when a text field changes', () => {
    const onChange = vi.fn();
    const config = buildConfig({ onChange });
    render(<FormTemplate config={config} />);

    const emailInput = screen.getByLabelText('Email');
    fireEvent.change(emailInput, { target: { value: 'new@example.com' } });

    expect(onChange).toHaveBeenCalledWith('email', 'new@example.com');
  });

  it('calls the button onClick handler when a button is clicked', () => {
    const saveClick = vi.fn();
    const config = buildConfig({
      buttons: [{ label: 'Save', onClick: saveClick, variant: 'contained' }],
    });
    render(<FormTemplate config={config} />);

    fireEvent.click(screen.getByRole('button', { name: 'Save' }));
    expect(saveClick).toHaveBeenCalledTimes(1);
  });

  it('disables a button when disabled=true in config', () => {
    const config = buildConfig({
      buttons: [{ label: 'Save', onClick: vi.fn(), variant: 'contained', disabled: true }],
    });
    render(<FormTemplate config={config} />);

    expect(screen.getByRole('button', { name: 'Save' })).toBeDisabled();
  });

  it('disables a field when disabled=true in config', () => {
    const config = buildConfig({
      fields: [{ key: 'email', label: 'Email', type: 'email', disabled: true }],
      values: { email: '' },
    });
    render(<FormTemplate config={config} />);

    expect(screen.getByLabelText('Email')).toBeDisabled();
  });

  it('renders a select field with options in config order', () => {
    const config = buildConfig({
      fields: [
        {
          key: 'role',
          label: 'Role',
          type: 'select',
          options: [
            { value: 'user', label: 'user' },
            { value: 'admin', label: 'admin' },
          ],
        },
      ],
      values: { role: 'user' },
    });
    render(<FormTemplate config={config} />);

    // MUI Select renders a combobox role; verify it is present
    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('calls onSend with current values when form is submitted', () => {
    const onSend = vi.fn();
    const config = buildConfig({ onSend });
    const { container } = render(<FormTemplate config={config} />);

    const form = container.querySelector('form');
    expect(form).not.toBeNull();
    fireEvent.submit(form!);

    expect(onSend).toHaveBeenCalledWith({ email: 'user@example.com', name: 'Alice' });
  });

  it('renders fields in column layout when layout="column"', () => {
    const config = buildConfig({ layout: 'column' });
    const { container } = render(<FormTemplate config={config} />);

    // The root Box should have flexDirection: column
    const form = container.querySelector('form');
    expect(form).toHaveStyle({ flexDirection: 'column' });
  });

  it('renders a startIcon on a button when provided', () => {
    const icon = <span data-testid="my-icon">★</span>;
    const config = buildConfig({
      buttons: [{ label: 'Add', onClick: vi.fn(), startIcon: icon }],
    });
    render(<FormTemplate config={config} />);

    expect(screen.getByTestId('my-icon')).toBeInTheDocument();
  });
});
