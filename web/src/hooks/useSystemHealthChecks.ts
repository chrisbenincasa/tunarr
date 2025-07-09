import type { UseQueryOptions } from '@tanstack/react-query';
import type { HealthCheck } from '@tunarr/types';
import type { StrictOmit } from 'ts-essentials';
import { useApiSuspenseQuery } from './useApiQuery';

export const useSystemHealthChecks = (
  opts?: StrictOmit<
    UseQueryOptions<Record<string, HealthCheck>>,
    'queryKey' | 'queryFn'
  >,
) => {
  return useApiSuspenseQuery({
    ...opts,
    queryKey: ['system', 'health'],
    queryFn: (api) => api.getSystemHealth(),
    staleTime: 15_000,
  });
};
