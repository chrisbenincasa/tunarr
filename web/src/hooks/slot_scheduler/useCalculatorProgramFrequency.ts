import { useChannelEditorLazy } from '@/store/selectors.ts';
import { groupBy, mapValues, round } from 'lodash-es';
import { useCallback } from 'react';

export const useCalculateProgramFrequency = () => {
  const { materializeNewProgramList } = useChannelEditorLazy();

  const calculateProgramFrequency = useCallback(() => {
    const lineup = materializeNewProgramList();
    const total = lineup.length;
    return mapValues(
      groupBy(lineup, (program) => {
        switch (program.type) {
          case 'content':
            {
              switch (program.subtype) {
                case 'movie':
                  return 'movie';
                case 'episode':
                  return `show.${program.showId}`;
                case 'track':
                  return `artist.${program.artistId}`;
              }
            }
            break;
          case 'custom':
            return `custom-show.${program.customShowId}`;
          case 'flex':
            return 'flex';
          case 'redirect':
            return `redirect.${program.channel}`;
        }
      }),
      (group) => round((group.length / total) * 100, 2),
    );
  }, [materializeNewProgramList]);

  return calculateProgramFrequency;
};
