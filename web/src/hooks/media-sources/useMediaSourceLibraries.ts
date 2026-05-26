import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import { getMediaSourceLibrariesOptions } from '../../generated/@tanstack/react-query.gen.ts';

export const useMediaSourceLibraries = (
  mediaSourceId: string,
  opts?: Partial<ReturnType<typeof getMediaSourceLibrariesOptions>>,
) =>
  useQuery({
    ...getMediaSourceLibrariesOptions({ path: { id: mediaSourceId } }),
    enabled: opts?.enabled ?? true,
    staleTime: 60 * 1000,
    ...opts,
  });

export const useMediaSourceLibrariesSuspense = (mediaSourceId: string) =>
  useSuspenseQuery({
    ...getMediaSourceLibrariesOptions({ path: { id: mediaSourceId } }),
    staleTime: 60 * 1000,
  });
