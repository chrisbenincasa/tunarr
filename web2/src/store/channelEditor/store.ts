import { Channel } from 'dizquetv-types';
import { StateCreator } from 'zustand';

export interface ChannelEditorStateInner {
  currentChannel?: Channel;
}

export interface ChannelEditorState {
  channelEditor: ChannelEditorStateInner;
}

export const initialChannelEditorState: ChannelEditorState = {
  channelEditor: {},
};

export const createChannelEditorState: StateCreator<{
  channelEditor: ChannelEditorState;
}> = () => ({ channelEditor: initialChannelEditorState });
