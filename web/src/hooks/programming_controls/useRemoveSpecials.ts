import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { useRemoveProgramming } from './useRemoveProgramming.ts';

export const useRemoveSpecials = () => {
  const programs = useStore(materializedProgramListSelector);
  const removeProgramming = useRemoveProgramming();

  return () => {
    if (programs.length > 0) {
      removeProgramming({ specials: true });
    }
  };
};
