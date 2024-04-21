import { CondensedChannelProgram } from '@tunarr/types';
import _ from 'lodash-es';
import { ReplicationType } from '../../components/programming_controls/AddReplicateModal.tsx';
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
  const replicatedArray = _.flatMap(
    _.times(numberOfReplications, () => [...programs]),
  );

  if (type === 'random') {
    return _.shuffle(replicatedArray);
  } else {
    return replicatedArray;
  }
};
