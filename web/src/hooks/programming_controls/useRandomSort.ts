import { flatten, groupBy, shuffle, values } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { match } from 'ts-pattern';
import type { ShuffleGroupingValue } from '../../components/programming_controls/ShuffleProgrammingModal.tsx';
import { getProgramGroupingKey } from '../../helpers/programUtil.ts';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import useStore from '../../store/index.ts';
import {
  useChannelEditorLazy,
  useCustomShowEditor,
} from '../../store/selectors.ts';
import {
  isUIContentProgram,
  type UIChannelProgram,
} from '../../types/index.ts';

export function useCustomShowRandomSort() {
  const { programList } = useCustomShowEditor();
  return () => {
    setCurrentCustomShowProgramming(shuffle(programList));
  };
}

function useRandomSort<ProgramType extends UIChannelProgram>({
  getter,
  setter,
}: GetterSetter<ProgramType>) {
  return useCallback(() => {
    setter(shuffle(getter()));
  }, [getter, setter]);
}

export function useRandomSortByShow<ProgramType extends UIChannelProgram>({
  getter,
  setter,
}: GetterSetter<ProgramType>) {
  return useCallback(() => {
    const list = getter();
    const chunks = groupBy(list, (program) => getProgramGroupingKey(program));
    const programs = flatten(shuffle(values(chunks)));
    setter(programs);
  }, [getter, setter]);
}

type GetterSetter<ProgramType extends UIChannelProgram> = {
  getter: () => ProgramType[];
  setter: (programs: ProgramType[]) => void;
};

function useCurrentEditorGetterSetter(): GetterSetter<UIChannelProgram> {
  const entityType = useStore((s) => s.currentEntityType);
  const channelEditor = useChannelEditorLazy();
  const customEditor = useCustomShowEditor();

  return useMemo(() => {
    return match(entityType)
      .returnType<GetterSetter<UIChannelProgram>>()
      .with('custom-show', () => {
        return {
          getter: () => customEditor.programList,
          setter: (programs) =>
            setCurrentCustomShowProgramming(
              programs.filter(isUIContentProgram),
            ),
        };
      })
      .with('channel', () => ({
        getter: () => channelEditor.materializeNewProgramList(),
        setter: (programs: UIChannelProgram[]) =>
          setCurrentLineup(programs, true),
      }))
      .otherwise(() => ({
        getter: () => [] as UIChannelProgram[],
        setter: (_: UIChannelProgram[]) => {},
      }));
  }, [channelEditor, customEditor.programList, entityType]);
}

export function useProgramShuffle() {
  const getterSetter = useCurrentEditorGetterSetter();

  const shuffler = useRandomSort(getterSetter);
  const byShowShuffler = useRandomSortByShow(getterSetter);

  return useCallback(
    (shuffleType: ShuffleGroupingValue) => {
      switch (shuffleType) {
        case 'none':
          shuffler();
          break;
        case 'show':
          byShowShuffler();
          break;
      }
    },
    [byShowShuffler, shuffler],
  );
}
