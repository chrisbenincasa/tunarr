import type { PlexFiltersResponse } from '@tunarr/types/plex';
import type { StateCreator } from 'zustand';

type PlexServerName = string;
type PlexServerKey = string; // ratingKey

interface PlexMetadataStateInternal {
  libraryFilters: Record<
    PlexServerName,
    Record<PlexServerKey, PlexFiltersResponse>
  >;
}

const empty = (): PlexMetadataStateInternal => ({
  libraryFilters: {},
});

export type PlexMetadataState = {
  plexMetadata: PlexMetadataStateInternal;
};

export const plexMetadataInitialState = empty();

export const createPlexMetadataState: StateCreator<PlexMetadataState> = () => {
  return { plexMetadata: plexMetadataInitialState };
};
