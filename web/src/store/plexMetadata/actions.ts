import type { PlexFiltersResponse } from '@tunarr/types/plex';
import useStore from '..';

export const setPlexMetadataFilters = (
  serverName: string,
  key: string,
  filters: PlexFiltersResponse,
) =>
  useStore.setState(({ plexMetadata: { libraryFilters } }) => {
    if (!libraryFilters[serverName]) {
      libraryFilters[serverName] = {};
    }

    libraryFilters[serverName][key] = filters;
  });
