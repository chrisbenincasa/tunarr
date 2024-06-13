import { Draft } from 'immer';
import { HasId, ProgrammingEditorState } from '../channelEditor/store';
import useStore from '../index.ts';

export function deleteProgramAtIndex<T extends HasId>(
  state: Draft<ProgrammingEditorState<T, unknown>>,
  idx: number,
) {
  if (
    state.programList.length > 0 &&
    idx >= 0 &&
    idx < state.programList.length
  ) {
    state.programList.splice(idx, 1);
    state.dirty.programs = true;
  }
}
export const deleteProgram = (idx: number) =>
  useStore.setState(({ channelEditor }) => {
    deleteProgramAtIndex(channelEditor, idx);
  });

export const removeCustomShowProgram = (idx: number) =>
  useStore.setState(({ customShowEditor }) => {
    deleteProgramAtIndex(customShowEditor, idx);
  });

export const removeFillerListProgram = (idx: number) =>
  useStore.setState(({ fillerListEditor }) => {
    deleteProgramAtIndex(fillerListEditor, idx);
  });
