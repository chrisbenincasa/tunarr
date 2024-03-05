import { Dispatch, SetStateAction, useState } from 'react';
import { useDebounce } from 'usehooks-ts';

export default function useDebouncedState<S>(
  initialState: S | (() => S),
  delay?: number,
): [S, S, Dispatch<SetStateAction<S>>] {
  const [s, set] = useState(initialState);
  const db = useDebounce(s, delay);
  return [s, db, set];
}
