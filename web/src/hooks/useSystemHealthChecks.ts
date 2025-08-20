import { useSuspenseQuery } from '@tanstack/react-query';
import { getApiSystemHealthOptions } from '../generated/@tanstack/react-query.gen.ts';

export const useSystemHealthChecks = () => {
  return useSuspenseQuery({
    ...getApiSystemHealthOptions(),
    staleTime: 15_000,
  });
};
