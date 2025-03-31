import type { State } from '@/store';
import useStore from '@/store';
import type { Nilable } from '@/types/util';
import type { QueryKey, QueryOptions } from '@tanstack/react-query';
import { useQueryClient } from '@tanstack/react-query';
import { isEmpty, isNil } from 'lodash-es';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { type MarkRequired } from 'ts-essentials';

function usePromise<T>() {
  const resolveRef = useRef<((data: T) => void) | null>(null);
  const rejectRef = useRef<((reason?: unknown) => void) | null>(null);
  const p = useRef(
    new Promise<T>((resolve, reject) => {
      resolveRef.current = resolve;
      rejectRef.current = reject;
    }),
  );

  const [result, setResult] = useState<T | null>(null);

  useEffect(() => {
    if (!result) {
      p.current.then((res) => setResult(res)).catch(console.warn);
    }
  }, [p, result]);

  return {
    promise: p.current,
    result,
    resolve: resolveRef.current!,
    reject: rejectRef.current!,
  };
}

export function useSuspendedStore<T>(
  f: (state: State) => Nilable<T>,
  condition: (selected: Nilable<T>) => selected is T = (s): s is T => !isNil(s),
): T {
  const { resolve, promise } = usePromise<boolean>();

  const v = f(useSyncExternalStore(useStore.subscribe, useStore.getState));

  if (!condition(v)) {
    // eslint-disable-next-line @typescript-eslint/only-throw-error
    throw promise;
  } else {
    resolve(true);
    return v;
  }
}

export function useSuspendedStoreList<T>(f: (state: State) => Nilable<T[]>) {
  return useSuspendedStore(f, (s): s is T[] => !isEmpty(s) && !isNil(s));
}

// TESTING!! Don't use these
export function useQueryDependentSuspendedStore<Key extends QueryKey>(
  key: Key,
) {
  const queryClient = useQueryClient();
  const state = queryClient.getQueryState(key);
  console.log(state);
}

export function useQueryDependentSuspendedStore2(
  opts: MarkRequired<QueryOptions, 'queryKey'>,
) {
  return useQueryDependentSuspendedStore(opts.queryKey);
}
