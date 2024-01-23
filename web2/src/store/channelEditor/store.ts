import {
  Channel,
  ChannelProgram,
  ContentProgram,
  CustomProgram,
  CustomShow,
} from 'dizquetv-types';
import { StateCreator } from 'zustand';

// Represents a program listing in the editor
export interface ProgrammingEditorStateInner<
  EntityType,
  ProgramType extends ChannelProgram = ChannelProgram,
> {
  // Original state of the working entity. Used to reset state
  originalEntity?: EntityType;
  // The working entity - edits should be made directly here
  currentEntity?: EntityType;
  // The programs in the state they were when we fetched them
  // This can be used to reset the state of the editor and
  // start over changes without having to close/enter the page
  originalProgramList: ProgramType[];
  // The actively edited list
  programList: ProgramType[];
  dirty: {
    programs: boolean;
  };
}

export interface ChannelEditorState {
  channelEditor: ProgrammingEditorStateInner<Channel>;
  customShowEditor: ProgrammingEditorStateInner<
    CustomShow,
    ContentProgram | CustomProgram // You cannot add Flex to custom shows
  >;
}

export const initialChannelEditorState: ChannelEditorState = {
  channelEditor: {
    originalProgramList: [],
    programList: [],
    dirty: {
      programs: false,
    },
  },
  customShowEditor: {
    originalProgramList: [],
    programList: [],
    dirty: {
      programs: false,
    },
  },
};

export const createChannelEditorState: StateCreator<
  ChannelEditorState
> = () => {
  return initialChannelEditorState;
};
