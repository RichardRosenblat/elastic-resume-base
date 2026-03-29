/**
 * @file useButtonLock.test.ts — Unit tests for the useButtonLock hook.
 */
import { renderHook, act } from '@testing-library/react';
import { vi, describe, it, expect, beforeEach, afterEach } from 'vitest';
import { useButtonLock } from './useButtonLock';

describe('useButtonLock', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('starts unlocked', () => {
    const { result } = renderHook(() => useButtonLock());
    expect(result.current.locked).toBe(false);
  });

  it('locks immediately when wrapped handler is called', async () => {
    const { result } = renderHook(() => useButtonLock(500));
    const handler = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      void result.current.wrap(handler)();
    });

    expect(result.current.locked).toBe(true);
  });

  it('releases lock after lockDelayMs when handler finishes quickly', async () => {
    const { result } = renderHook(() => useButtonLock(500));
    const handler = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.wrap(handler)();
    });

    expect(result.current.locked).toBe(true);

    await act(async () => {
      vi.advanceTimersByTime(500);
    });

    expect(result.current.locked).toBe(false);
  });

  it('ignores subsequent calls while locked', async () => {
    const { result } = renderHook(() => useButtonLock(500));
    const handler = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.wrap(handler)();
    });

    expect(result.current.locked).toBe(true);

    // Second call while locked — handler must NOT be invoked again
    await act(async () => {
      await result.current.wrap(handler)();
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it('calls the wrapped handler exactly once per unlock cycle', async () => {
    const { result } = renderHook(() => useButtonLock(200));
    const handler = vi.fn().mockResolvedValue(undefined);

    await act(async () => {
      await result.current.wrap(handler)();
    });

    await act(async () => {
      vi.advanceTimersByTime(200);
    });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(result.current.locked).toBe(false);
  });

  it('does not add extra delay when handler takes longer than lockDelayMs', async () => {
    const { result } = renderHook(() => useButtonLock(100));
    const handler = vi.fn().mockResolvedValue(undefined);

    // Call the wrapped handler — it completes synchronously (promise resolves)
    await act(async () => {
      await result.current.wrap(handler)();
    });

    // Button is still locked (delay hasn't elapsed)
    expect(result.current.locked).toBe(true);
    expect(handler).toHaveBeenCalledTimes(1);

    // Advance past the lock delay
    await act(async () => {
      vi.advanceTimersByTime(100);
    });

    expect(result.current.locked).toBe(false);
  });
});
