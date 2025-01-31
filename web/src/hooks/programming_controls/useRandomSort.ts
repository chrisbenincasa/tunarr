import { shuffle } from 'lodash-es';
import { setCurrentLineup } from '../../store/channelEditor/actions.ts';
import { setCurrentCustomShowProgramming } from '../../store/customShowEditor/actions.ts';
import {
  useChannelEditorLazy,
  useCustomShowEditor,
} from '../../store/selectors.ts';

export function useRandomSort() {
  const { materializeNewProgramList } = useChannelEditorLazy();

  return () => {
    setCurrentLineup(shuffle(materializeNewProgramList()), true);
  };
}

export function useCustomShowRandomSort() {
  const { programList } = useCustomShowEditor();
  return () => {
    setCurrentCustomShowProgramming(shuffle(programList));
  };
}
