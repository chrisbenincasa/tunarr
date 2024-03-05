import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import _ from 'lodash-es';

export function useRemoveFlex() {
  const programs = useStore(materializedProgramListSelector);

  return function () {
    setCurrentLineup(_.filter(programs, (program) => program.type != 'flex'));
  };
}
