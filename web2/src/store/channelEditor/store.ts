import { Channel, ChannelProgram } from 'dizquetv-types';
import { StateCreator } from 'zustand';

// Represents a program listing in the editor
export interface ChannelEditorStateInner {
  // Original state of the working channel. Used to reset state
  originalChannel?: Channel;
  // The working channel - edits should be made directly here
  currentChannel?: Channel;
  // The programs in the state they were when we fetched them
  // This can be used to reset the state of the editor and
  // start over changes without having to close/enter the page
  originalProgramList: ChannelProgram[];
  // The actively edited list
  programList: ChannelProgram[];
  dirty: {
    programs: boolean;
  };
}

export interface ChannelEditorState {
  channelEditor: ChannelEditorStateInner;
}

export const initialChannelEditorState: ChannelEditorState = {
  channelEditor: {
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
