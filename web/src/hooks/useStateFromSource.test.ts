import { act, renderHook } from '@testing-library/react';
import { describe, expect, test } from 'vitest';
import { useStateFromSource } from './useStateFromSource.ts';

const double = (n: number) => n * 2;

describe('useStateFromSource', () => {
  test('seeds the state from the source', () => {
    const { result } = renderHook(() => useStateFromSource(2, double));
    expect(result.current[0]).toBe(4);
  });

  test('keeps local edits while the source is unchanged', () => {
    const { result, rerender } = renderHook(
      ({ source }) => useStateFromSource(source, double),
      { initialProps: { source: 2 } },
    );

    act(() => result.current[1](7));
    rerender({ source: 2 });

    expect(result.current[0]).toBe(7);
  });

  test('re-seeds when the source changes', () => {
    const { result, rerender } = renderHook(
      ({ source }) => useStateFromSource(source, double),
      { initialProps: { source: 2 } },
    );

    act(() => result.current[1](7));
    rerender({ source: 3 });

    expect(result.current[0]).toBe(6);
  });

  test('compares the source by identity', () => {
    const first = [1, 2];
    const { result, rerender } = renderHook(
      ({ source }) => useStateFromSource(source, (s) => [...s]),
      { initialProps: { source: first } },
    );

    act(() => result.current[1]([9, 9]));
    rerender({ source: first });
    expect(result.current[0]).toEqual([9, 9]);

    rerender({ source: [1, 2] });
    expect(result.current[0]).toEqual([1, 2]);
  });
});
