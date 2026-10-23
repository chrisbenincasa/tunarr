import { useState } from 'react';

// Local state seeded from `source`. When `source` changes identity, such as a
// form value after reset(), the state is re-seeded from it during render.
export function useStateFromSource<S, T>(source: S, derive: (source: S) => T) {
  const [state, setState] = useState(() => derive(source));
  const [seededFrom, setSeededFrom] = useState(source);

  if (!Object.is(source, seededFrom)) {
    setSeededFrom(source);
    setState(derive(source));
  }

  return [state, setState] as const;
}
