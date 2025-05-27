import { useChannelEditorLazy } from '@/store/selectors.ts';
import { groupBy, mapValues, round } from 'lodash-es';
import { useCallback } from 'react';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';

export const useCalculateProgramFrequency = () => {
  const { materializeNewProgramList } = useChannelEditorLazy();

  const calculateProgramFrequency = useCallback(() => {
    const lineup = materializeNewProgramList();
    const total = lineup.length;
    return mapValues(groupBy(lineup, getProgramGroupingKey), (group) =>
      round((group.length / total) * 100, 2),
    );
  }, [materializeNewProgramList]);

  return calculateProgramFrequency;
};
