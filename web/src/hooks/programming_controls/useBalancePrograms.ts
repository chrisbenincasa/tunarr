import { setCurrentLineup } from '@/store/channelEditor/actions.ts';
import useStore from '@/store/index.ts';
import { materializedProgramListSelector } from '@/store/selectors.ts';
import type { ChannelProgram } from '@tunarr/types';
import { every, flatMap, forEach, maxBy, range, values } from 'lodash-es';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';
import { removeDuplicatePrograms } from './useRemoveDuplicates.ts';

type BalanceGroup = {
  totalDuration: number;
  programs: ChannelProgram[];
};

export type BalanceProgramsOptions = {
  balanceType: 'duration' | 'programCount';
  frequencies?: Record<string, number>;
};

const extractMaxByFunc = (
  balanceType: BalanceProgramsOptions['balanceType'],
) => {
  return (group: BalanceGroup) => {
    switch (balanceType) {
      case 'duration':
        return group.totalDuration;
      case 'programCount':
        return group.programs.length;
    }
  };
};

export const useBalancePrograms = () => {
  const programs = useStore(materializedProgramListSelector);

  return (opts: BalanceProgramsOptions) => {
    const groups: Record<string, BalanceGroup> = {};
    const dedupedPrograms = removeDuplicatePrograms(programs);
    forEach(dedupedPrograms, (p) => {
      if (p.type === 'flex') {
        return;
      }

      const key = getProgramGroupingKey(p);
      groups[key] ??= {
        totalDuration: 0,
        programs: [],
      };

      groups[key].totalDuration += p.duration;
      groups[key].programs.push(p);
    });

    // This is where we'd apply frequencies if we wanted to scale
    // each show
    const maxChunk = maxBy(values(groups), extractMaxByFunc(opts.balanceType));

    const factorDivisor = extractMaxByFunc(opts.balanceType);
    const maxCount = maxChunk ? factorDivisor(maxChunk) : 0;

    const factor = every(groups, (group) => {
      return Math.floor((maxCount * 2) / factorDivisor(group)) % 2 === 0;
    })
      ? 1
      : 2;

    const newProgramList: ChannelProgram[] = [];
    for (const group of values(groups)) {
      const loops = Math.floor((maxCount * factor) / factorDivisor(group));
      newProgramList.push(...flatMap(range(0, loops), () => group.programs));
    }

    setCurrentLineup(newProgramList, true);
  };
};
