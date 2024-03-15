import { CustomProgram, CustomShow, PlexServerSettings } from '@tunarr/types';
import { PlexLibrarySection, PlexMedia } from '@tunarr/types/plex';
import { StateCreator } from 'zustand';

type ServerName = string;
type PlexItemGuid = string;

export type PlexSelectedMedia = {
  type: 'plex';
  server: ServerName;
  guid: PlexItemGuid;
};

export type CustomShowSelectedMedia = {
  type: 'custom-show';
  customShowId: string;
  program: CustomProgram;
};

export type SelectedMedia = PlexSelectedMedia | CustomShowSelectedMedia;

export type PlexLibrary = {
  type: 'plex';
  library: PlexLibrarySection;
};

export type CustomShowLibrary = {
  type: 'custom-show';
  library: CustomShow;
};

export type SelectedLibrary = PlexLibrary | CustomShowLibrary;

export interface ProgrammingListingsState {
  currentServer?: PlexServerSettings;
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
}

export const createProgrammingListingsState: StateCreator<
  ProgrammingListingsState
> = () => ({
  knownMediaByServer: {},
  selectedMedia: [],
  contentHierarchyByServer: {},
});
