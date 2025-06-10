import type { ContentProgram } from '@tunarr/types';
import type { StateCreator } from 'zustand';

export interface ProgrammingState {
  programLookup: Record<string, ContentProgram>;
}

export const createProgrammingState: StateCreator<ProgrammingState> = () => ({
  programLookup: {},
});
