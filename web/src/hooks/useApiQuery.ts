import {
  DefaultError,
  QueryClient,
  QueryFunction,
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { ApiClient } from '../external/api';
import { useTunarrApi } from './useTunarrApi';

export function useApiQuery<
  TQueryFnData = unknown,
  TError = DefaultError,
  TData = TQueryFnData,
  TQueryKey extends QueryKey = QueryKey,
>(
  options: Omit<
    UseQueryOptions<TQueryFnData, TError, TData, TQueryKey>,
    'queryFn'
  > & {
    queryFn: (
      apiClient: ApiClient,
      ...rest: Parameters<QueryFunction<TQueryFnData, TQueryKey, never>>
    ) => ReturnType<QueryFunction<TQueryFnData, TQueryKey, never>>;
  },
  queryClient?: QueryClient,
): UseQueryResult<TData, TError> {
  const apiClient = useTunarrApi();
  return useQuery(
    {
      ...options,
      queryFn: (args) => options.queryFn(apiClient, args),
    },
    queryClient,
  );
}
