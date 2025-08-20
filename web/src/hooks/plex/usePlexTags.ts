import { useCurrentPlexMediaSourceAndLibraryView } from '@/store/programmingSelector/selectors.ts';
import { useQuery } from '@tanstack/react-query';
import type { PlexTagResult } from '@tunarr/types/plex';
import { plexQueryOptions } from './plexHookUtil.ts';

export const usePlexTags = (key: string) => {
  const [selectedServer, selectedLibrary] =
    useCurrentPlexMediaSourceAndLibraryView();
  const path = selectedLibrary
    ? `/library/sections/${selectedLibrary.library.key}/${key}`
    : '';

  return useQuery<PlexTagResult>({
    ...plexQueryOptions(selectedServer?.id ?? '', path),
  });
};
