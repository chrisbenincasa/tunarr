import { emptyEntityEditor } from '@/store/entityEditor/util.ts';
import type { UIContentProgram } from '@/types/index.ts';
import { type UICondensedChannelProgram, type UIIndex } from '@/types/index.ts';
import {
  type Channel,
  type CondensedChannelProgram,
  type ContentProgram,
  type CustomProgram,
  type CustomShow,
  type FillerList,
} from '@tunarr/types';
import {
  type DynamicContentConfig,
  type LineupSchedule,
} from '@tunarr/types/api';
import { type StateCreator } from 'zustand';

export type HasId = { id: string };

// Represents a program listing in the editor
export interface ProgrammingEditorState<
  EntityType extends HasId = HasId,
  ProgramType extends CondensedChannelProgram = CondensedChannelProgram,
> {
  // Original state of the working entity. Used to reset state
  originalEntity?: EntityType;
  // The working entity - edits should be made directly here
  currentEntity?: EntityType;
  // The programs in the state they were when we fetched them
  // This can be used to reset the state of the editor ands
  // start over changes without having to close/enter the page
  originalProgramList: (ProgramType & UIIndex)[];
  // The actively edited list
  programList: (ProgramType & UIIndex)[];
  programsLoaded: boolean;
  dirty: {
    programs: boolean;
  };
}

export type ChannelEditorState = ProgrammingEditorState<
  Channel,
  UICondensedChannelProgram
> & {
  // Since for channels we deal with 'condensed' programs, we need to have
  // the lookup record for programs by ID
  programLookup: Record<string, ContentProgram>;
  schedule?: LineupSchedule;
  dynamicContentConfiguration?: DynamicContentConfig;
};

export type FillerListEditor = ProgrammingEditorState<
  FillerList,
  ContentProgram | CustomProgram
>;

export type CustomShowEditor = ProgrammingEditorState<
  CustomShow,
  UIContentProgram // Custom shows contain content only
>;

export interface EditorsState {
  channelEditor: ChannelEditorState;
  customShowEditor: CustomShowEditor;
  fillerListEditor: FillerListEditor;
  currentEntityType?: 'channel' | 'custom-show' | 'filler';
}

export const initialChannelEditorState: EditorsState = {
  channelEditor: { ...emptyEntityEditor(), programLookup: {} },
  customShowEditor: emptyEntityEditor(),
  fillerListEditor: emptyEntityEditor(),
};

export const createChannelEditorState: StateCreator<EditorsState> = () => {
  return initialChannelEditorState;
};
