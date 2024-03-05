import {
  DataTag,
  QueryClient,
  QueryKey,
  UseQueryOptions,
} from '@tanstack/react-query';
import { LoaderFunctionArgs } from 'react-router-dom';
import { Preloader } from '../types/index.ts';

export function createPreloader<
  T = unknown,
  QK extends QueryKey = QueryKey,
  TInferred = QK extends DataTag<ReadonlyArray<unknown>, infer TData>
    ? TData
    : T,
>(
  query: (
    args: LoaderFunctionArgs,
  ) => UseQueryOptions<TInferred, Error, TInferred, QK>,
  callback: (data: TInferred) => void = () => {},
): Preloader<TInferred> {
  return (queryClient: QueryClient) => async (args) => {
    const data: TInferred | undefined = await queryClient.ensureQueryData(
      query(args),
    );
    callback(data);
    return data;
  };
}
