import { CustomProgram, MediaSourceSettings } from '@tunarr/types';
import { PlexSearch } from '@tunarr/types/api';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import { PlexLibrarySection, PlexMedia } from '@tunarr/types/plex';
import { MediaSourceId } from '@tunarr/types/schemas';
import { StateCreator } from 'zustand';

type ItemUuid = string;

export type PlexSelectedMedia = {
  type: 'plex';
} & ExternalSourceSelectedMedia;

export type CustomShowSelectedMedia = {
  type: 'custom-show';
  customShowId: string;
  childCount?: number;
  totalDuration: number;
  programs: CustomProgram[];
};

export type JellyfinSelectedMedia = {
  type: 'jellyfin';
} & ExternalSourceSelectedMedia;

export type ExternalSourceSelectedMedia = {
  serverId: MediaSourceId;
  // This is needed for "legacy" reasons right now
  serverName: string;
  id: ItemUuid;
  childCount?: number;
};

export type SelectedMedia =
  | PlexSelectedMedia
  | JellyfinSelectedMedia
  | CustomShowSelectedMedia;

export type PlexLibrary = {
  type: 'plex';
  library: PlexLibrarySection;
};

export type JellyfinLibrary = {
  type: 'jellyfin';
  library: JellyfinItem;
};

export type CustomShowLibrary = {
  type: 'custom-show';
};

export type SelectedLibrary = PlexLibrary | JellyfinLibrary | CustomShowLibrary;

export type PlexMediaItems = {
  type: 'plex';
  item: PlexLibrarySection | PlexMedia;
};

export type JellyfinItems = {
  type: 'jellyfin';
  item: JellyfinItem;
};

export type MediaItems = PlexMediaItems | JellyfinItems;

export type KnownMediaMap = Record<MediaSourceId, Record<ItemUuid, MediaItems>>;

export type ContentHierarchyMap = Record<
  MediaSourceId,
  Record<ItemUuid, ItemUuid[]>
>;

export interface ProgrammingListingsState {
  currentServer?: MediaSourceSettings;
  currentLibrary?: SelectedLibrary;
  // Tracks the parent-child mappings of library items
  contentHierarchyByServer: ContentHierarchyMap;
  // Holds the actual metadata for items, including directories (i.e. Plex libraries)
  knownMediaByServer: KnownMediaMap;
  selectedMedia: SelectedMedia[];
  // List of fully enumerated selected media.
  // This list is unique by ID, per media source
  flattenedSelectedMedia: SelectedMedia[];
  plexSearch: PlexSearch & {
    urlFilter?: string; // Validated PlexFilter ready to be used as a request query param
  };
}

export const createProgrammingListingsState: StateCreator<
  ProgrammingListingsState
> = () => ({
  knownMediaByServer: {},
  selectedMedia: [],
  flattenedSelectedMedia: [],
  contentHierarchyByServer: {},
  plexSearch: {},
});
