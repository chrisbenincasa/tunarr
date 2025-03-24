import type { UseQueryOptions } from '@tanstack/react-query';
import type { HealthCheck } from '@tunarr/types';
import type { StrictOmit } from 'ts-essentials';
import { useApiQuery } from './useApiQuery';

export const useSystemHealthChecks = (
  opts?: StrictOmit<
    UseQueryOptions<Record<string, HealthCheck>>,
    'queryKey' | 'queryFn'
  >,
) => {
  return useApiQuery({
    ...opts,
    queryKey: ['system', 'health'],
    queryFn: (api) => api.getSystemHealth(),
  });
};
