import { random } from '@/helpers/random.ts';
import { removeDuplicatePrograms } from '@/hooks/programming_controls/useRemoveDuplicates.ts';
import { groupBy, mapValues, orderBy } from 'lodash-es';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { useChannelEditorLazy } from '../../store/selectors.ts';
import type {
  UIChannelProgram,
  UIContentProgram,
  UICustomProgram,
} from '../../types/index.ts';

export function useCyclicShuffle() {
  const { materializeNewProgramList } = useChannelEditorLazy();

  return function () {
    const programCandidates = removeDuplicatePrograms(
      materializeNewProgramList(),
    ).filter(
      (program): program is UIContentProgram | UICustomProgram =>
        program.type === 'content' || program.type === 'custom',
    );

    const groupedContent = mapValues(
      groupBy(programCandidates, getProgramGroupingKey),
      (programs) => {
        const firstProgram = programs[0];
        if (firstProgram.type === 'content') {
          programs = orderBy(
            programs as UIContentProgram[],
            [(p) => p.parent?.index, (p) => p.index],
            'asc',
          );
        } else if (firstProgram.type === 'custom') {
          programs = orderBy(
            programs as UICustomProgram[],
            (program) => program.index,
          );
        }

        return programs;
      },
    );

    const currIndexes = mapValues(groupedContent, (c) =>
      random.integer(0, c.length - 1),
    );

    const cycledShows: UIChannelProgram[] = [];

    for (const candidate of random.shuffle([...programCandidates])) {
      const key = getProgramGroupingKey(candidate);
      const idx = currIndexes[key];
      const group = groupedContent[key];
      cycledShows.push(group[idx]);
      currIndexes[key] = (currIndexes[key] + 1) % group.length;
    }

    setCurrentLineup(cycledShows, true);
  };
}
