import {
  DefaultError,
  QueryClient,
  QueryFunction,
  QueryKey,
  UseQueryOptions,
  UseQueryResult,
  useQuery,
} from '@tanstack/react-query';
import { getApiClient } from '../components/TunarrApiContext';
import { ApiClient } from '../external/api';

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
  // NOTE that this query also depends on the backendUrl used to
  // create the API client, but we explicitly don't include it in the
  // queryKey here because:
  // 1. it makes the types super unwieldy
  // 2. we do a mass cache invalidation in the tunarr API context when
  //    the backend URL changes
  // 3. it keeps query keys simple for when we have to do more fine-grained
  //    invalidation (e.g. post-mutates)
  return useQuery(
    {
      ...options,
      queryFn: (args) => options.queryFn(getApiClient(), args),
    },
    queryClient,
  );
}
