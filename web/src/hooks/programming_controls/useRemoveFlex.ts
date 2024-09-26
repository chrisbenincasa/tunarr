import { some } from 'lodash-es';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { useRemoveProgramming } from './useRemoveProgramming.ts';

export function useRemoveFlex() {
  const programs = useStore(materializedProgramListSelector);
  const removeProgramming = useRemoveProgramming();

  return function () {
    const hasFlex = some(programs, { type: 'flex' });
    if (hasFlex) {
      removeProgramming({ flex: true });
    }
  };
}
