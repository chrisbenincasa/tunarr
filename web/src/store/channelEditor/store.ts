import {
  Channel,
  ContentProgram,
  CustomProgram,
  CustomShow,
  FillerList,
} from '@tunarr/types';
import { DynamicContentConfig, LineupSchedule } from '@tunarr/types/api';
import { StateCreator } from 'zustand';
import { UICondensedChannelProgram, UIIndex } from '../../types/index.ts';

// Represents a program listing in the editor
export interface ProgrammingEditorState<EntityType, ProgramType> {
  // Original state of the working entity. Used to reset state
  originalEntity?: EntityType;
  // The working entity - edits should be made directly here
  currentEntity?: EntityType;
  // The programs in the state they were when we fetched them
  // This can be used to reset the state of the editor and
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

export interface EditorsState {
  channelEditor: ChannelEditorState;
  customShowEditor: ProgrammingEditorState<
    CustomShow,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
  fillerListEditor: ProgrammingEditorState<
    FillerList,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
}

const empty = () => ({
  originalProgramList: [],
  programList: [],
  schedulePreviewList: [],
  programsLoaded: false,
  dirty: {
    programs: false,
  },
});

export const initialChannelEditorState: EditorsState = {
  channelEditor: { ...empty(), programLookup: {} },
  customShowEditor: empty(),
  fillerListEditor: empty(),
};

export const createChannelEditorState: StateCreator<EditorsState> = () => {
  return initialChannelEditorState;
};
