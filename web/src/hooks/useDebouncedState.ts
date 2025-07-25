import type { Dispatch, SetStateAction } from 'react';
import { useState } from 'react';
import type { DebouncedState } from 'usehooks-ts';
import { useDebounceValue } from 'usehooks-ts';

export default function useDebouncedState<S>(
  initialState: S | (() => S),
  delay?: number,
  // They don't expose a type for these options lmao
  opts?: Parameters<typeof useDebounceValue>[2],
): [S, S, Dispatch<SetStateAction<S>>, DebouncedState<(value: S) => void>] {
  const [s, set] = useState(initialState);
  const [dbValue, dbSet] = useDebounceValue(s, delay ?? 500, opts);
  return [s, dbValue, set, dbSet];
}
