import type { SearchRequest } from '@tunarr/types/api';
import { createContext } from 'react';
import { type AddedMedia } from '../types/index.ts';
import { type Nullable } from '../types/util.ts';

type EntityType = 'channel' | 'filler-list' | 'custom-show';
type MediaSourceChange = { mediaSourceId?: string; libraryId?: string };

export type ProgrammingSelectionContextType = {
  onAddSelectedMedia: (programs: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  entityType: EntityType;
  initialMediaSourceId?: string;
  initialLibraryId?: string;
  onSourceChange: (change: MediaSourceChange) => void;
  onSearchChange: (searchRequest: SearchRequest) => void;
};

export const ProgrammingSelectionContext =
  createContext<Nullable<ProgrammingSelectionContextType>>(null);
