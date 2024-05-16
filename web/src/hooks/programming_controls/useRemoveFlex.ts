import { reject } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export function useRemoveFlex() {
  const programs = useStore(materializedProgramListSelector);

  return function () {
    let changed = false;
    const newLineup = reject(programs, (program) => {
      if (program.type === 'flex') {
        changed = true;
        return true;
      }
      return false;
    });
    setCurrentLineup(newLineup, changed ? changed : undefined);
  };
}
