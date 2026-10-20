import { useQuery, useSuspenseQuery } from '@tanstack/react-query';
import type { MediaSourceLibrary } from '@tunarr/types';
import { getApiMediaSourcesByIdLibrariesOptions } from '../../generated/@tanstack/react-query.gen.ts';

// Disabled libraries are never synced, so they have no content to offer.
export const selectEnabledLibraries = <
  T extends Pick<MediaSourceLibrary, 'enabled'>,
>(
  libraries: T[],
): T[] => libraries.filter((lib) => lib.enabled);

export const useMediaSourceLibraries = (
  mediaSourceId: string,
  opts?: Partial<ReturnType<typeof getApiMediaSourcesByIdLibrariesOptions>>,
) =>
  useQuery({
    ...getApiMediaSourcesByIdLibrariesOptions({ path: { id: mediaSourceId } }),
    enabled: opts?.enabled ?? true,
    staleTime: 60 * 1000,
    ...opts,
  });

export const useMediaSourceLibrariesSuspense = (mediaSourceId: string) =>
  useSuspenseQuery({
    ...getApiMediaSourcesByIdLibrariesOptions({ path: { id: mediaSourceId } }),
    staleTime: 60 * 1000,
  });
