import { renderHook, act } from '@testing-library/react';
import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';
import { usePreviewSimulation } from './usePreviewSimulation';

describe('usePreviewSimulation', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('initializes with default nodes and simulation state false', () => {
    const { result } = renderHook(() => usePreviewSimulation());

    expect(result.current.isSimulating).toBe(false);
    expect(result.current.showConsole).toBe(false);
    expect(result.current.nodes.length).toBe(4);
    expect(result.current.edges.length).toBe(3);
  });

  it('starts simulation and progresses through steps with timers', () => {
    const { result } = renderHook(() => usePreviewSimulation());

    act(() => {
      result.current.handleTestRun();
    });

    expect(result.current.isSimulating).toBe(true);
    expect(result.current.showConsole).toBe(true);

    // Fast-forward through step 1 (200ms)
    act(() => {
      vi.advanceTimersByTime(250);
    });
    expect(result.current.nodes[0].data.status).toBe('running');

    // Fast-forward through step 2 (900ms)
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(result.current.nodes[0].data.status).toBe('success');
    expect(result.current.nodes[1].data.status).toBe('running');

    // Fast-forward until completion (3200ms)
    act(() => {
      vi.advanceTimersByTime(2500);
    });
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.activeTab).toBe('receipt');
  });

  it('resets state on handleReset', () => {
    const { result } = renderHook(() => usePreviewSimulation());

    act(() => {
      result.current.handleTestRun();
    });
    expect(result.current.isSimulating).toBe(true);

    act(() => {
      result.current.handleReset();
    });
    expect(result.current.isSimulating).toBe(false);
    expect(result.current.showConsole).toBe(false);
    expect(result.current.logs).toEqual([]);
  });
});

