import { useContext } from 'react';
import {
  ProgrammingSelectionContext,
  type ProgrammingSelectionContextType,
} from '../context/ProgrammingSelectionContext.ts';

export const useProgrammingSelectionContext = () =>
  useContext(
    ProgrammingSelectionContext,
  ) as NonNullable<ProgrammingSelectionContextType>;
