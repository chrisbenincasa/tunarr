import { type CondensedChannelProgram } from '@tunarr/types';
import { type Draft } from 'immer';
import { isSet, reject } from 'lodash-es';
import {
  type HasId,
  type ProgrammingEditorState,
} from '../channelEditor/store';
import useStore from '../index.ts';

export function deleteProgramAtIndex<T extends HasId>(
  state: Draft<ProgrammingEditorState<T, CondensedChannelProgram>>,
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

export function deleteProgramById<
  T extends HasId,
  P extends CondensedChannelProgram,
>(state: Draft<ProgrammingEditorState<T, P>>, ids: Set<string>) {
  let changed = false;
  state.programList = reject(state.programList, (program) => {
    if (program.type === 'content' || program.type === 'custom') {
      if (program.id && ids.has(program.id)) {
        changed = true;
        return true;
      }
    }

    return false;
  });
  if (changed) {
    state.dirty.programs = true;
  }
}

export const deleteProgram = (idx: number) =>
  useStore.setState(({ channelEditor }) => {
    deleteProgramAtIndex(channelEditor, idx);
  });

export const removeChannelProgramsById = (ids: string | Set<string>) =>
  useStore.setState(({ channelEditor }) => {
    deleteProgramById(channelEditor, isSet(ids) ? ids : new Set([ids]));
  });

export const removeCustomShowProgram = (idx: number) =>
  useStore.setState(({ customShowEditor }) => {
    deleteProgramAtIndex(customShowEditor, idx);
  });

export const removeFillerListProgram = (idx: number) =>
  useStore.setState(({ fillerListEditor }) => {
    deleteProgramAtIndex(fillerListEditor, idx);
  });

export const emptyEntityEditor = () => ({
  originalProgramList: [],
  programList: [],
  schedulePreviewList: [],
  programsLoaded: false,
  dirty: {
    programs: false,
  },
});
