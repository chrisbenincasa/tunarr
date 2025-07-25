import type {
  DataTag,
  DefinedInitialDataOptions,
  QueryFunction,
  UseQueryOptions,
} from '@tanstack/react-query';
import type { NonUndefinedGuard } from '../types';

export function makeQueryOptions<
  K extends readonly unknown[],
  Fn extends QueryFunction,
  Err = Error,
  T = Fn extends QueryFunction<infer T> ? T : unknown,
  OutT = T,
>(
  key: K,
  func: QueryFunction<T>,
  opts: Omit<
    UseQueryOptions<T, Err, OutT, DataTag<K, T>>,
    'queryKey' | 'queryFn'
  > = {},
): UseQueryOptions<T, Err, OutT, DataTag<K, T>> {
  return {
    queryKey: key as DataTag<K, T>,
    queryFn: func,
    ...opts,
  };
}

export function makeQueryOptionsInitialData<
  K extends readonly unknown[],
  Fn extends QueryFunction,
  Err = Error,
  T = Fn extends QueryFunction<infer T> ? T : unknown,
>(
  key: K,
  func: QueryFunction<T>,
  initialData: NonUndefinedGuard<T>,
  opts: Omit<
    UseQueryOptions<T, Err, T, DataTag<K, T>>,
    'queryKey' | 'queryFn' | 'initialData'
  > = {},
): DefinedInitialDataOptions<T, Err, T, DataTag<K, T>> {
  return {
    queryKey: key as DataTag<K, T>,
    queryFn: func,
    initialData,
    ...opts,
  };
}
