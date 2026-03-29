import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import FileUploadTemplate from './FileUploadTemplate';
import type { FileUploadConfig } from './types';

// ─── helpers ────────────────────────────────────────────────────────────────

function buildConfig(overrides: Partial<FileUploadConfig> = {}): FileUploadConfig {
  return {
    accept: '.pdf,.docx,.zip',
    files: [],
    onFilesChange: vi.fn(),
    buttons: [
      {
        label: 'Process & Download',
        onClick: vi.fn(),
        variant: 'contained',
        disabled: false,
      },
    ],
    selectFilesLabel: 'Select Files',
    clearLabel: 'Clear',
    description: 'Upload documents for OCR.',
    acceptedFormats: ['PDF', 'DOCX', 'ZIP'],
    ...overrides,
  };
}

// ─── FileUploadTemplate tests ────────────────────────────────────────────────

describe('FileUploadTemplate', () => {
  it('renders description when provided', () => {
    render(<FileUploadTemplate config={buildConfig()} />);
    expect(screen.getByText('Upload documents for OCR.')).toBeInTheDocument();
  });

  it('renders accepted format chips', () => {
    render(<FileUploadTemplate config={buildConfig()} />);
    expect(screen.getByText('PDF')).toBeInTheDocument();
    expect(screen.getByText('DOCX')).toBeInTheDocument();
    expect(screen.getByText('ZIP')).toBeInTheDocument();
  });

  it('renders the Select Files button', () => {
    render(<FileUploadTemplate config={buildConfig()} />);
    expect(screen.getByRole('button', { name: /select files/i })).toBeInTheDocument();
  });

  it('renders action buttons from config', () => {
    render(<FileUploadTemplate config={buildConfig()} />);
    expect(screen.getByRole('button', { name: 'Process & Download' })).toBeInTheDocument();
  });

  it('disables Select Files button when disabled=true', () => {
    const config = buildConfig({ disabled: true });
    render(<FileUploadTemplate config={config} />);
    expect(screen.getByRole('button', { name: /select files/i })).toBeDisabled();
  });

  it('disables an action button when its disabled=true', () => {
    const config = buildConfig({
      buttons: [{ label: 'Process & Download', onClick: vi.fn(), variant: 'contained', disabled: true }],
    });
    render(<FileUploadTemplate config={config} />);
    expect(screen.getByRole('button', { name: 'Process & Download' })).toBeDisabled();
  });

  it('calls the action button onClick when clicked', () => {
    const onClick = vi.fn();
    const config = buildConfig({
      buttons: [{ label: 'Process', onClick, variant: 'contained', disabled: false }],
    });
    render(<FileUploadTemplate config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Process' }));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('shows the clear button when files are selected', () => {
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const config = buildConfig({ files: [file] });
    render(<FileUploadTemplate config={config} />);
    expect(screen.getByRole('button', { name: 'Clear' })).toBeInTheDocument();
  });

  it('calls onFilesChange with empty array when clear button is clicked', () => {
    const onFilesChange = vi.fn();
    const file = new File(['content'], 'test.pdf', { type: 'application/pdf' });
    const config = buildConfig({ files: [file], onFilesChange });
    render(<FileUploadTemplate config={config} />);
    fireEvent.click(screen.getByRole('button', { name: 'Clear' }));
    expect(onFilesChange).toHaveBeenCalledWith([]);
  });

  it('renders file names and sizes when files are selected', () => {
    const file = new File(['x'.repeat(2048)], 'document.pdf', { type: 'application/pdf' });
    const config = buildConfig({ files: [file] });
    render(<FileUploadTemplate config={config} />);
    expect(screen.getByText('document.pdf')).toBeInTheDocument();
    expect(screen.getByText('2.0 KB')).toBeInTheDocument();
  });

  it('does not show the clear button when no files are selected', () => {
    const config = buildConfig({ files: [] });
    render(<FileUploadTemplate config={config} />);
    expect(screen.queryByRole('button', { name: 'Clear' })).not.toBeInTheDocument();
  });

  it('renders success alert when showSuccess and successMessage are provided', () => {
    const config = buildConfig({ showSuccess: true, successMessage: 'File downloaded!' });
    render(<FileUploadTemplate config={config} />);
    expect(screen.getByText('File downloaded!')).toBeInTheDocument();
  });

  it('does not render success alert when showSuccess is false', () => {
    const config = buildConfig({ showSuccess: false, successMessage: 'File downloaded!' });
    render(<FileUploadTemplate config={config} />);
    expect(screen.queryByText('File downloaded!')).not.toBeInTheDocument();
  });

  it('does not render format chips when acceptedFormats is omitted', () => {
    const config = buildConfig({ acceptedFormats: undefined });
    render(<FileUploadTemplate config={config} />);
    expect(screen.queryByText('PDF')).not.toBeInTheDocument();
  });

  it('always calls onFilesChange — even when file count exceeds maxFiles (parent validates)', () => {
    const onFilesChange = vi.fn();
    const config = buildConfig({ maxFiles: 1, onFilesChange });
    const { container } = render(<FileUploadTemplate config={config} />);

    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const files = [
      new File(['a'], 'a.pdf', { type: 'application/pdf' }),
      new File(['b'], 'b.pdf', { type: 'application/pdf' }),
    ];
    Object.defineProperty(input, 'files', { value: files, configurable: true });
    fireEvent.change(input);

    // The template always propagates; the parent decides what to do.
    expect(onFilesChange).toHaveBeenCalledWith(files);
  });

  it('does not render description when omitted', () => {
    const config = buildConfig({ description: undefined });
    render(<FileUploadTemplate config={config} />);
    expect(screen.queryByText('Upload documents for OCR.')).not.toBeInTheDocument();
  });

  it('uses selectedFilesLabel with {count} interpolation', () => {
    const file = new File(['x'], 'a.pdf', { type: 'application/pdf' });
    const config = buildConfig({
      files: [file],
      selectedFilesLabel: '{count} file(s) selected',
    });
    render(<FileUploadTemplate config={config} />);
    expect(screen.getByText('1 file(s) selected')).toBeInTheDocument();
  });
});
