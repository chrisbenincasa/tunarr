import {
  DataTag,
  QueryClient,
  QueryKey,
  UseQueryOptions,
} from '@tanstack/react-query';
import { LoaderFunctionArgs } from 'react-router-dom';
import { Preloader } from '../types/index.ts';
import { ApiClient } from '../external/api.ts';
import { getApiClient } from '../components/TunarrApiContext.tsx';

export function createPreloader<
  T = unknown,
  QK extends QueryKey = QueryKey,
  TInferred = QK extends DataTag<ReadonlyArray<unknown>, infer TData>
    ? TData
    : T,
>(
  query: (
    apiClient: ApiClient,
    args: LoaderFunctionArgs,
  ) => UseQueryOptions<TInferred, Error, TInferred, QK>,
  callback: (data: TInferred) => void = () => {},
): Preloader<TInferred> {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  return (queryClient: QueryClient) => async (args) => {
    const data: TInferred | undefined = await queryClient.ensureQueryData(
      query(getApiClient(), args),
    );
    callback(data);
    return data;
  };
}
