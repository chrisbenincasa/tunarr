import { shuffle } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export function useRandomSort() {
  const programs = useStore(materializedProgramListSelector);

  return function () {
    setCurrentLineup(shuffle(programs), true);
  };
}
