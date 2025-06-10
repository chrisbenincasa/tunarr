import type { CondensedChannelProgram } from '@tunarr/types';
import { flatMap, shuffle, times } from 'lodash-es';
import type { ReplicationType } from '../../components/programming_controls/AddReplicateModal.tsx';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import { materializedProgramListSelector } from '../../store/selectors.ts';

export function useReplicatePrograms() {
  const programs = useStore(materializedProgramListSelector);

  return (numberOfReplications: number, type: ReplicationType) => {
    setCurrentLineup(
      replicatePrograms(programs, numberOfReplications, type),
      true,
    );
  };
}

export const replicatePrograms = (
  programs: CondensedChannelProgram[],
  numberOfReplications: number,
  type: ReplicationType,
) => {
  const replicatedArray = flatMap(
    times(numberOfReplications, () => [...programs]),
  );

  if (type === 'random') {
    return shuffle(replicatedArray);
  } else {
    return replicatedArray;
  }
};
