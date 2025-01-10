import { AddedMedia } from '@/types/index.ts';
import React from 'react';

export interface AddProgrammingContextType {
  onAddSelectedMedia: (media: AddedMedia[], prepend?: boolean) => void;
  onAddMediaSuccess: () => void;
}

export const AddProgrammingContext =
  React.createContext<AddProgrammingContextType | null>(null);
