/**
 * @file toast-context.test.tsx — Unit tests for ToastProvider hover-pause behaviour.
 *
 * Key scenarios verified:
 *  1. A toast auto-closes after its duration.
 *  2. Hovering pauses the countdown; the toast stays visible past the original
 *     deadline and closes only after the remaining time elapses post-hover.
 *  3. Close button removes the toast immediately.
 */
import { render, screen, act, fireEvent } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ToastProvider } from './toast-context';
import { useToast } from './use-toast';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Tiny consumer component that calls showToast on mount. */
function ToastTrigger({
  message,
  durationMs,
}: {
  message: string;
  durationMs: number;
}) {
  const { showToast } = useToast();
  return (
    <button
      type="button"
      onClick={() => showToast(message, { severity: 'info', durationMs })}
    >
      show
    </button>
  );
}

function renderWithProvider(durationMs = 3000) {
  return render(
    <ToastProvider>
      <ToastTrigger message="Hello toast" durationMs={durationMs} />
    </ToastProvider>,
  );
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('ToastProvider — hover-pause behaviour', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('shows a toast when showToast is called', async () => {
    renderWithProvider();

    await act(async () => {
      screen.getByRole('button', { name: 'show' }).click();
    });

    expect(screen.getByText('Hello toast')).toBeInTheDocument();
  });

  it('auto-closes the toast after its duration', async () => {
    renderWithProvider(2000);

    await act(async () => {
      screen.getByRole('button', { name: 'show' }).click();
    });

    expect(screen.getByText('Hello toast')).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.queryByText('Hello toast')).not.toBeInTheDocument();
  });

  it('does NOT close the toast while the user is hovering over it', async () => {
    renderWithProvider(2000);

    await act(async () => {
      screen.getByRole('button', { name: 'show' }).click();
    });

    const alert = screen.getByRole('alert');

    // Hover over the toast before the timer expires
    await act(async () => {
      fireEvent.mouseEnter(alert);
    });

    // Advance past the original deadline — toast must still be visible
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    expect(screen.getByText('Hello toast')).toBeInTheDocument();
  });

  it('closes the toast after the remaining time elapses once the user stops hovering', async () => {
    renderWithProvider(2000);

    await act(async () => {
      screen.getByRole('button', { name: 'show' }).click();
    });

    const alert = screen.getByRole('alert');

    // Hover after 1000 ms — 1000 ms remain
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await act(async () => {
      fireEvent.mouseEnter(alert);
    });

    // Advance past the original deadline; toast still visible because hovered
    await act(async () => {
      vi.advanceTimersByTime(1500);
    });

    expect(screen.getByText('Hello toast')).toBeInTheDocument();

    // Stop hovering; timer should resume with ~1000 ms remaining
    await act(async () => {
      fireEvent.mouseLeave(alert);
    });

    // Advance past the remaining time
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.queryByText('Hello toast')).not.toBeInTheDocument();
  });

  it('closes immediately when the close button is clicked', async () => {
    renderWithProvider(5000);

    await act(async () => {
      screen.getByRole('button', { name: 'show' }).click();
    });

    expect(screen.getByText('Hello toast')).toBeInTheDocument();

    // Find and click the MUI Alert close button (aria-label="Close")
    const closeButton = screen.getByTitle('Close');
    await act(async () => {
      closeButton.click();
    });

    expect(screen.queryByText('Hello toast')).not.toBeInTheDocument();
  });
});
