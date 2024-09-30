import { Draft } from 'immer';
import {
  BaseEntityEditorState,
  ChannelEditorState,
  HasId,
} from '../channelEditor/store';
import useStore from '../index.ts';

export function deleteProgramAtIndex<T extends HasId>(
  state: Draft<BaseEntityEditorState<T, unknown>>,
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

export const emptyEntityEditor = <
  EntityType extends HasId,
  ProgramType,
>(): BaseEntityEditorState<EntityType, ProgramType> => ({
  originalProgramList: [],
  programList: [],
  programsLoaded: false,
  dirty: {
    programs: false,
  },
  addProgramsInProgress: false,
});

export const emptyChannelEditor = (): ChannelEditorState => ({
  ...emptyEntityEditor(),
  type: 'channel',
});

export const emptyEditorOfType = <
  Editor extends BaseEntityEditorState<HasId, unknown>,
  EntityType extends HasId = Editor extends BaseEntityEditorState<
    infer EntityTypeInferred,
    unknown
  >
    ? EntityTypeInferred
    : never,
  ProgramType = Editor extends BaseEntityEditorState<
    HasId,
    infer ProgramTypeInferred
  >
    ? ProgramTypeInferred
    : never,
>(): BaseEntityEditorState<EntityType, ProgramType> => ({
  ...emptyEntityEditor(),
});
