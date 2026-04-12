import { useSuspenseQuery } from '@tanstack/react-query';
import { getSystemHealthOptions } from '../generated/@tanstack/react-query.gen.ts';

export const useSystemHealthChecks = () => {
  return useSuspenseQuery({
    ...getSystemHealthOptions(),
    staleTime: 15_000,
  });
};
