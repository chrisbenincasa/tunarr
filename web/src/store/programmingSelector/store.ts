import { type CustomProgram, type MediaSourceSettings } from '@tunarr/types';
import { type PlexSearch } from '@tunarr/types/api';
import { type EmbyItem } from '@tunarr/types/emby';
import type { TunarrAmendedJellyfinVirtualFolder } from '@tunarr/types/jellyfin';
import { type JellyfinItem } from '@tunarr/types/jellyfin';
import {
  type PlexLibrarySection,
  type PlexMedia,
  type PlexPlaylists,
} from '@tunarr/types/plex';
import { type MediaSourceId } from '@tunarr/types/schemas';
import { type StateCreator } from 'zustand';
import {
  type Emby,
  type ItemUuid,
  type Jellyfin,
  type Plex,
  type Typed,
  type TypedKey,
} from '../../types/MediaSource';

export type PlexSelectedMedia = Typed<ExternalSourceSelectedMedia, Plex>;

export type CustomShowSelectedMedia = {
  type: 'custom-show';
  customShowId: string;
  childCount?: number;
  totalDuration: number;
  programs: CustomProgram[];
};

export type JellyfinSelectedMedia = Typed<
  ExternalSourceSelectedMedia,
  Jellyfin
>;

export type EmbySelectedMedia = Typed<ExternalSourceSelectedMedia, Emby>;

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
  | EmbySelectedMedia
  | CustomShowSelectedMedia;

export const PlexMediaSourceLibraryViewType = {
  Library: 'library' as const,
  Playlists: 'playlists' as const,
} as const;

export type PlexMediaSourceLibrarySubview = 'collections' | 'playlists';

export type PlexMediaSourceLibraryView = {
  type: 'library';
  library: PlexLibrarySection;
  subview?: PlexMediaSourceLibrarySubview;
};

export type PlexMediaSourcePlaylistsView = {
  type: 'playlists';
  playlists: PlexPlaylists;
};

type TypedView<T, Type> = TypedKey<T, Type, 'view'>;

export type PlexMediaSourceView = TypedView<
  PlexMediaSourceLibraryView | PlexMediaSourcePlaylistsView,
  Plex
>;

export type JellyfinMediaSourceView = TypedView<
  TunarrAmendedJellyfinVirtualFolder,
  Jellyfin
>;

export type EmbyMediaSourceView = TypedView<EmbyItem, Emby>;

export type CustomShowView = {
  type: 'custom-show';
};

export type MediaSourceView =
  | PlexMediaSourceView
  | JellyfinMediaSourceView
  | EmbyMediaSourceView
  | CustomShowView;

type TypedItem<T, Type> = TypedKey<T, Type, 'item'>;

export type MediaGenre = TypedItem<string, Jellyfin | Plex | Emby>;

export type MediaItems =
  | TypedItem<PlexLibrarySection | PlexMedia, Plex>
  | TypedItem<JellyfinItem | TunarrAmendedJellyfinVirtualFolder, Jellyfin>
  | TypedItem<EmbyItem, Emby>;

export type KnownMediaMap = Record<MediaSourceId, Record<ItemUuid, MediaItems>>;

export type ContentHierarchyMap = Record<
  MediaSourceId,
  Record<ItemUuid, ItemUuid[]>
>;

export interface ProgrammingListingsState {
  currentMediaSource?: MediaSourceSettings;
  currentMediaSourceView?: MediaSourceView;
  currentMediaGenre?: string;
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
