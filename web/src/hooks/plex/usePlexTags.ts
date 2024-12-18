import { useCurrentPlexMediaSourceAndLibraryView } from '@/store/programmingSelector/selectors.ts';
import { useQuery } from '@tanstack/react-query';
import { tag } from '@tunarr/types';
import { PlexTagResult } from '@tunarr/types/plex';
import { useTunarrApi } from '../useTunarrApi.ts';
import { plexQueryOptions } from './plexHookUtil.ts';

export const usePlexTags = (key: string) => {
  const apiClient = useTunarrApi();
  const [selectedServer, selectedLibrary] =
    useCurrentPlexMediaSourceAndLibraryView();
  const path = selectedLibrary
    ? `/library/sections/${selectedLibrary.library.key}/${key}`
    : '';

  return useQuery<PlexTagResult>({
    ...plexQueryOptions(apiClient, selectedServer?.id ?? tag(''), path),
  });
};
