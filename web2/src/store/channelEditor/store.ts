import {
  Channel,
  ContentProgram,
  CustomProgram,
  CustomShow,
  FillerList,
} from '@tunarr/types';
import { StateCreator } from 'zustand';
import { UICondensedChannelProgram } from '../../types/index.ts';

export type UIIndex = { originalIndex: number };

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
  dirty: {
    programs: boolean;
  };
}

export interface ChannelEditorState {
  channelEditor: ProgrammingEditorState<Channel, UICondensedChannelProgram> & {
    // Since for channels we deal with 'condensed' programs, we need to have
    // the lookup record for programs by ID
    programLookup: Record<string, ContentProgram>;
  };
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
  dirty: {
    programs: false,
  },
});

export const initialChannelEditorState: ChannelEditorState = {
  channelEditor: { ...empty(), programLookup: {} },
  customShowEditor: empty(),
  fillerListEditor: empty(),
};

export const createChannelEditorState: StateCreator<
  ChannelEditorState
> = () => {
  return initialChannelEditorState;
};
