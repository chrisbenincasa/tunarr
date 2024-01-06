import { Channel, EphemeralProgram, TvGuideProgram } from 'dizquetv-types';
import { StateCreator } from 'zustand';

// Represents a program listing in the editor
export type WorkingProgram = TvGuideProgram | EphemeralProgram;

export function isEphemeralProgram(p: WorkingProgram): p is EphemeralProgram {
  return !p.persisted;
}

export interface ChannelEditorStateInner {
  currentChannel?: Channel;
  programList: WorkingProgram[];
  dirty: {
    programs: boolean;
  };
}

export interface ChannelEditorState {
  channelEditor: ChannelEditorStateInner;
}

export const initialChannelEditorState: ChannelEditorState = {
  channelEditor: {
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
