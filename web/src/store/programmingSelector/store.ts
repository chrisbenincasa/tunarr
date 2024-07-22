import { CustomProgram } from '@tunarr/types';
import { PlexSearch } from '@tunarr/types/api';
import { PlexLibrarySection, PlexMedia } from '@tunarr/types/plex';
import { StateCreator } from 'zustand';
import { MediaSourceSettings } from '@tunarr/types';
import { JellyfinLibrary as ApiJellyfinLibrary } from '@tunarr/types/jellyfin';

type ServerName = string;
type PlexItemGuid = string;

export type PlexSelectedMedia = {
  type: 'plex';
  server: ServerName;
  guid: PlexItemGuid;
  childCount?: number;
};

export type CustomShowSelectedMedia = {
  type: 'custom-show';
  customShowId: string;
  childCount?: number;
  totalDuration: number;
  programs: CustomProgram[];
};

export type SelectedMedia = PlexSelectedMedia | CustomShowSelectedMedia;

export type PlexLibrary = {
  type: 'plex';
  library: PlexLibrarySection;
};

export type JellyfinLibrary = {
  type: 'jellyfin';
  library: ApiJellyfinLibrary;
};

export type CustomShowLibrary = {
  type: 'custom-show';
};

export type SelectedLibrary = PlexLibrary | JellyfinLibrary | CustomShowLibrary;

export interface ProgrammingListingsState {
  currentServer?: MediaSourceSettings;
  currentLibrary?: SelectedLibrary;
  // Tracks the parent-child mappings of library items
  contentHierarchyByServer: Record<
    ServerName,
    Record<PlexItemGuid, PlexItemGuid[]>
  >;
  // Holds the actual metadata for items, including directories (i.e. Plex libraries)
  knownMediaByServer: Record<
    ServerName,
    Record<PlexItemGuid, PlexLibrarySection | PlexMedia>
  >;
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
