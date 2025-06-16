import type {
  DefaultError,
  QueryKey,
  QueryObserverOptions,
  QueryObserverResult,
} from '@tanstack/react-query';
import { QueryObserver, useQueryClient } from '@tanstack/react-query';
import { useEffect, useMemo } from 'react';

export const useQueryObserver = <
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  queryOpts: QueryObserverOptions<
    TQueryFnData,
    TError,
    TData,
    TQueryData,
    TQueryKey
  >,
  callback: (result: QueryObserverResult<TData, TError>) => void,
) => {
  const client = useQueryClient();
  const observer = useMemo(
    () => new QueryObserver(client, queryOpts),
    [client, queryOpts],
  );

  useEffect(() => {
    const unsubscribe = observer.subscribe((result) => {
      callback(result);
    });
    return unsubscribe;
  }, [callback, observer]);
};
