import { createContext } from 'react';
import { type AddedMedia } from '../types/index.ts';
import { type Nullable } from '../types/util.ts';

type EntityType = 'channel' | 'filler-list' | 'custom-show';

export type ProgrammingSelectionContextType = {
  onAddSelectedMedia: (programs: AddedMedia[]) => void;
  onAddMediaSuccess: () => void;
  entityType: EntityType;
};

export const ProgrammingSelectionContext =
  createContext<Nullable<ProgrammingSelectionContextType>>(null);
