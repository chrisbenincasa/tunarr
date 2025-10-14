import { isNonEmptyString } from '@/helpers/util.ts';
import useStore from '@/store/index.ts';
import { setPlexMetadataFilters } from '@/store/plexMetadata/actions.ts';
import { useCurrentMediaSourceAndView } from '@/store/programmingSelector/selectors.ts';
import type { Maybe } from '@/types/util.ts';
import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { getApiPlexByMediaSourceIdFiltersOptions } from '../../generated/@tanstack/react-query.gen.ts';
import { Plex } from '../../helpers/constants.ts';

export const usePlexFilters = (serverId: Maybe<string>, plexKey: string) => {
  const query = useQuery({
    ...getApiPlexByMediaSourceIdFiltersOptions({
      path: {
        mediaSourceId: serverId ?? '',
      },
      query: {
        key: plexKey,
      },
    }),
    enabled: isNonEmptyString(serverId) && plexKey.length > 0,
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
  const [selectedServer, selectedLibrary] = useCurrentMediaSourceAndView(Plex);
  return usePlexFilters(
    selectedServer?.id,
    selectedLibrary?.view.type === 'library'
      ? selectedLibrary?.view.library.externalId
      : '',
  );
};
