import { CustomProgram, MediaSourceSettings } from '@tunarr/types';
import { PlexSearch } from '@tunarr/types/api';
import { JellyfinItem } from '@tunarr/types/jellyfin';
import {
  PlexLibrarySection,
  PlexMedia,
  PlexPlaylists,
} from '@tunarr/types/plex';
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

export const PlexMediaSourceLibraryViewType = {
  Library: 'library' as const,
  Playlists: 'playlists' as const,
} as const;

export type PlexMediaSourceLibraryView = {
  type: 'library';
  library: PlexLibrarySection;
};

export type PlexMediaSourcePlaylistsView = {
  type: 'playlists';
  playlists: PlexPlaylists;
};

export type PlexMediaSourceView = {
  type: 'plex';
  view: PlexMediaSourceLibraryView | PlexMediaSourcePlaylistsView;
};

export type JellyfinMediaSourceView = {
  type: 'jellyfin';
  library: JellyfinItem;
};

export type CustomShowView = {
  type: 'custom-show';
};

export type MediaSourceView =
  | PlexMediaSourceView
  | JellyfinMediaSourceView
  | CustomShowView;

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
  currentMediaSource?: MediaSourceSettings;
  currentMediaSourceView?: MediaSourceView;
  // Tracks the parent-child mappings of library items
  contentHierarchyByServer: ContentHierarchyMap;
  // Holds the actual metadata for items, including directories (i.e. Plex libraries)
  knownMediaByServer: KnownMediaMap;
  selectedMedia: SelectedMedia[];
  plexSearch: PlexSearch & {
    urlFilter?: string; // Validated PlexFilter ready to be used as a request query param
  };
}

export const createProgrammingListingsState: StateCreator<
  ProgrammingListingsState
> = () => ({
  knownMediaByServer: {},
  selectedMedia: [],
  contentHierarchyByServer: {},
  plexSearch: {},
});
