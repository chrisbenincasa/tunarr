import { DataTag, QueryFunction, UseQueryOptions } from '@tanstack/react-query';

export function makeQueryOptions<
  K extends readonly unknown[],
  Fn extends QueryFunction,
  Err = Error,
  T = Fn extends QueryFunction<infer T> ? T : unknown,
>(
  key: K,
  func: QueryFunction<T>,
  opts: Omit<
    UseQueryOptions<T, Err, T, DataTag<K, T>>,
    'queryKey' | 'queryFn'
  > = {},
): UseQueryOptions<T, Err, T, DataTag<K, T>> {
  return {
    queryKey: key as DataTag<K, T>,
    queryFn: func,
    ...opts,
  };
}
