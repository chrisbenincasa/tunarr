import { useQuery } from '@tanstack/react-query';
import { PlexFiltersResponse } from '@tunarr/types/plex';
import { useEffect } from 'react';
import { setPlexMetadataFilters } from '@/store/plexMetadata/actions.ts';
import useStore from '@/store/index.ts';
import { useTunarrApi } from '@/hooks/useTunarrApi.ts';
import { plexQueryOptions } from '@/hooks/plex/plexHookUtil.ts';

export const usePlexFilters = (serverName: string, plexKey: string) => {
  const apiClient = useTunarrApi();
  const key = `/library/sections/${plexKey}/all?includeMeta=1&includeAdvanced=1&X-Plex-Container-Start=0&X-Plex-Container-Size=0`;
  const query = useQuery<PlexFiltersResponse>({
    ...plexQueryOptions(
      apiClient,
      serverName,
      key,
      serverName.length > 0 && plexKey.length > 0,
    ),
    staleTime: 1000 * 60 * 60 * 60,
  });

  useEffect(() => {
    if (query.data) {
      setPlexMetadataFilters(serverName, plexKey, query.data);
    }
  }, [serverName, plexKey, query.data]);

  return {
    isLoading: query.isLoading,
    error: query.error,
    data: useStore(({ plexMetadata }) => {
      const server = plexMetadata.libraryFilters[serverName];
      if (server) {
        return server[plexKey]?.Meta;
      }
    }),
  };
};

// Like usePlexFilters, but uses the selected server and library from
// local state.
export const useSelectedLibraryPlexFilters = () => {
  const selectedServer = useStore((s) => s.currentServer);
  const selectedLibrary = useStore((s) =>
    s.currentLibrary?.type === 'plex' ? s.currentLibrary : null,
  );
  return usePlexFilters(
    selectedServer?.name ?? '',
    selectedLibrary?.library.key ?? '',
  );
};
