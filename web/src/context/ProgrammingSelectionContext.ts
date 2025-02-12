import type { SearchRequest } from '@tunarr/types/api';
import { createContext } from 'react';
import { type AddedMedia } from '../types/index.ts';
import { type Nullable } from '../types/util.ts';

type EntityType = 'channel' | 'filler-list' | 'custom-show';

export type ProgrammingSelectionContextType = {
  onAddSelectedMedia: (programs: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  entityType: EntityType;
  initialMediaSourceId?: string;
  initialLibraryId?: string;
  onMediaSourceChange: (mediaSourceId: string) => void;
  onLibraryChange: (libraryId: string) => void;
  onSearchChange: (searchRequest: SearchRequest) => void;
};

export const ProgrammingSelectionContext =
  createContext<Nullable<ProgrammingSelectionContextType>>(null);
