import { PlexServerSettings } from 'dizquetv-types';
import { PlexMedia, PlexLibrarySection } from 'dizquetv-types/plex';
import { StateCreator } from 'zustand';

export interface ProgrammingListing {
  guid: string;
  type: keyof PlexMedia['type'];
  children: ProgrammingListing[]; // GUIDs from the known media store
}

export interface ProgrammingDirectory {
  dir: PlexLibrarySection;
  children: ProgrammingListing[]; // GUIDs from the known media store
}

export interface SelectedMedia {
  server: string;
  guid: string;
}

export interface ProgrammingListingsState {
  currentServer?: PlexServerSettings;
  listingsByServer: Record<string, ProgrammingDirectory[]>;
  knownMediaByServer: Record<string, Record<string, PlexMedia>>;
  selectedMedia: SelectedMedia[];
}

export const createProgrammingListingsState: StateCreator<
  ProgrammingListingsState
> = () => ({ listingsByServer: {}, knownMediaByServer: {}, selectedMedia: [] });
