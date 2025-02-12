import type {
  Library,
  MediaSourceLibrary,
  Playlist,
  ProgramOrFolder,
} from '@tunarr/types';
import { type CustomProgram, type MediaSourceSettings } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { type PlexSearch } from '@tunarr/types/api';
import { type StateCreator } from 'zustand';
import type { Imported } from '../../types/MediaSource';
import {
  type Emby,
  type ItemUuid,
  type Jellyfin,
  type Plex,
  type Typed,
  type TypedKey,
} from '../../types/MediaSource';
import type { Nullable } from '../../types/util.ts';

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

export type ImportedLibrarySelectedMedia = Typed<
  ExternalSourceSelectedMedia,
  Imported
>;

export type ExternalSourceSelectedMedia = {
  mediaSource: MediaSourceSettings;
  libraryId: string;
  id: ItemUuid;
  childCount?: number;
};

export type SelectedMedia =
  | PlexSelectedMedia
  | JellyfinSelectedMedia
  | EmbySelectedMedia
  | CustomShowSelectedMedia
  | ImportedLibrarySelectedMedia;

export const PlexMediaSourceLibraryViewType = {
  Library: 'library' as const,
  Playlists: 'playlists' as const,
} as const;

export type PlexMediaSourceLibrarySubview = 'collections' | 'playlists';

export type PlexMediaSourceLibraryView = {
  type: 'library';
  library: Library;
  subview?: PlexMediaSourceLibrarySubview;
};

export type PlexMediaSourcePlaylistsView = {
  type: 'playlists';
  playlists: Playlist[];
};

type TypedView<T, Type> = TypedKey<T, Type, 'view'>;

export type PlexMediaSourceView = TypedView<
  PlexMediaSourceLibraryView | PlexMediaSourcePlaylistsView,
  Plex
>;

export type JellyfinMediaSourceView = TypedView<Library, Jellyfin>;

export type EmbyMediaSourceView = TypedView<Library, Emby>;

export type CustomShowView = {
  type: 'custom-show';
};

export type ImportedMediaSourceLibraryView = TypedView<
  MediaSourceLibrary,
  Imported
>;

export type MediaSourceView =
  | PlexMediaSourceView
  | JellyfinMediaSourceView
  | EmbyMediaSourceView
  | ImportedMediaSourceLibraryView
  | CustomShowView;

type TypedItem<T, Type> = TypedKey<T, Type, 'item'>;

export type MediaGenre = TypedItem<string, Jellyfin | Plex | Emby>;

export type MediaItems = ProgramOrFolder | Library;

export type KnownMediaMap = Record<string, Record<ItemUuid, MediaItems>>;

export type ContentHierarchyMap = Record<string, Record<ItemUuid, ItemUuid[]>>;

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
  currentSearchRequest: Nullable<SearchRequest>;
}

export const createProgrammingListingsState: StateCreator<
  ProgrammingListingsState
> = () => ({
  knownMediaByServer: {},
  selectedMedia: [],
  contentHierarchyByServer: {},
  plexSearch: {},
  currentSearchRequest: null,
});
