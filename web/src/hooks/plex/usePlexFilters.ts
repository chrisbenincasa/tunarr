import { useQuery } from '@tanstack/react-query';
import { PlexFiltersResponse } from '@tunarr/types/plex';
import { useEffect } from 'react';
import { setPlexMetadataFilters } from '@/store/plexMetadata/actions.ts';
import useStore from '@/store/index.ts';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import {
  emptyMediaSourceId,
  plexQueryOptions,
} from '@/hooks/plex/plexHookUtil.ts';
import { useCurrentMediaSourceAndLibrary } from '@/store/programmingSelector/selectors.ts';
import { MediaSourceId } from '@tunarr/types/schemas';
import { Maybe } from '@/types/util.ts';
import { isNonEmptyString } from '@/helpers/util.ts';

export const usePlexFilters = (
  serverId: Maybe<MediaSourceId>,
  plexKey: string,
) => {
  const apiClient = useTunarrApi();
  const key = `/library/sections/${plexKey}/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0`;
  const query = useQuery<PlexFiltersResponse>({
    ...plexQueryOptions(
      apiClient,
      serverId ?? emptyMediaSourceId,
      key,
      isNonEmptyString(serverId) && plexKey.length > 0,
    ),
    staleTime: 1000 * 60 * 60 * 60,
  });

  useEffect(() => {
    if (query.data && isNonEmptyString(serverId)) {
      setPlexMetadataFilters(serverId, plexKey, query.data);
    }
  }, [serverId, plexKey, query.data]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    data: useStore(({ plexMetadata }) => {
      const server = plexMetadata.libraryFilters[serverId ?? ''];
      if (server) {
        return server[plexKey]?.Meta;
      }
    }),
  };
};

// Like usePlexFilters, but uses the selected server and library from
// local state.
export const useSelectedLibraryPlexFilters = () => {
  const [selectedServer, selectedLibrary] =
    useCurrentMediaSourceAndLibrary('plex');
  return usePlexFilters(selectedServer?.id, selectedLibrary?.library.key ?? '');
};
