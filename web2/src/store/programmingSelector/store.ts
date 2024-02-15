import { PlexServerSettings } from '@tunarr/types';
import { PlexMedia, PlexLibrarySection } from '@tunarr/types/plex';
import { StateCreator } from 'zustand';

type ServerName = string;
type PlexItemGuid = string;

export interface SelectedMedia {
  server: ServerName;
  guid: PlexItemGuid;
}

export interface ProgrammingListingsState {
  currentServer?: PlexServerSettings;
  currentLibrary?: string; // This is the key
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
