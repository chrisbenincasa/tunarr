import { Channel, Program } from 'dizquetv-types';
import useStore from '..';
import { initialChannelEditorState } from './store.ts';

export const resetChannelEditorState = useStore.setState((state) => {
  const newState = {
    ...state,
    channelEditor: initialChannelEditorState,
  };

  return newState;
});

export const setCurrentChannel = (channel: Channel) =>
  useStore.setState((state) => {
    state.channelEditor.currentChannel = channel;
  });

export const addProgramsToCurrentChannel = (programs: Program[]) =>
  useStore.setState((state) => {
    if (state.channelEditor.currentChannel) {
      state.channelEditor.currentChannel.programs.push(...programs);
    }
  });
