import type { CondensedChannelProgram } from '@tunarr/types';
import { flatMap } from 'lodash-es';
import { useCallback } from 'react';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { useChannelEditorLazy } from '../../store/selectors.ts';
import type { UIChannelProgramWithOffset } from '../../types/index.ts';

export const useInterspersePrograms = () => {
  const { materializeNewProgramList } = useChannelEditorLazy();
  return useCallback(() => {
    setCurrentLineup(interspersePrograms(materializeNewProgramList()));
  }, [materializeNewProgramList]);
};

function interspersePrograms(
  programs: UIChannelProgramWithOffset[],
): CondensedChannelProgram[] {
  return flatMap(programs, (program) => [
    program,
    { type: 'flex', duration: 30_000, persisted: false },
  ]);
}
