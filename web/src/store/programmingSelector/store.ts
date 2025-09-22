import type {
  Library,
  MediaSourceLibrary,
  Playlist,
  ProgramOrFolder,
} from '@tunarr/types';
import { type CustomProgram, type MediaSourceSettings } from '@tunarr/types';
import type { SearchRequest } from '@tunarr/types/api';
import { type PlexSearch } from '@tunarr/types/api';
import type { StrictOmit } from 'ts-essentials';
import { type StateCreator } from 'zustand';
import type { Imported, Local } from '../../types/MediaSource';
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

export type LocalLibrarySelectedMedia = Typed<
  StrictOmit<ExternalSourceSelectedMedia, 'persisted'>,
  Local
>;

export type ExternalSourceSelectedMedia = {
  mediaSource: MediaSourceSettings;
  libraryId: string;
  id: ItemUuid;
  persisted: boolean;
  childCount?: number;
  type: Plex | Jellyfin | Emby;
};

export type LocalSourceSelectedMedia = {
  mediaSource: MediaSourceSettings;
  id: ItemUuid;
  persisted: true;
  childCount?: number;
  type: Local;
};

export type SelectedMedia =
  | CustomShowSelectedMedia
  | LocalSourceSelectedMedia
  | ExternalSourceSelectedMedia;

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

export type LocalMediaSourceView = TypedView<MediaSourceLibrary, Local>;

export type MediaSourceView =
  | PlexMediaSourceView
  | JellyfinMediaSourceView
  | EmbyMediaSourceView
  | ImportedMediaSourceLibraryView
  | CustomShowView
  | LocalMediaSourceView;

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
