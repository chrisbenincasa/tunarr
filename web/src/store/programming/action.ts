import type { ContentProgram } from '@tunarr/types';
import useStore from '../index.ts';

export const addProgramsToLookupTable = (
  programs: Record<string, ContentProgram>,
) =>
  useStore.setState((state) => {
    state.programLookup = {
      ...state.programLookup,
      ...programs,
    };
  });
