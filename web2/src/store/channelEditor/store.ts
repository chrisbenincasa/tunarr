import { Channel, TvGuideProgram } from 'dizquetv-types';
import { PlexMedia } from 'dizquetv-types/plex';
import { get, has } from 'lodash-es';
import { StateCreator } from 'zustand';

export type EphemeralProgram = {
  persisted: false;
  originalProgram: PlexMedia;
};

// Represents a program listing in the editor
export type WorkingProgram = TvGuideProgram | EphemeralProgram;

export function isEphemeralProgram(p: WorkingProgram): p is EphemeralProgram {
  return has(p, 'persisted') && !get(p, 'persisted');
}

export interface ChannelEditorStateInner {
  currentChannel?: Channel;
  programList: WorkingProgram[];
}

export interface ChannelEditorState {
  channelEditor: ChannelEditorStateInner;
}

export const initialChannelEditorState: ChannelEditorState = {
  channelEditor: {
    programList: [],
  },
};

export const createChannelEditorState: StateCreator<
  ChannelEditorState
> = () => {
  return {
    channelEditor: {
      programList: [],
    },
  };
};
