import isUndefined from 'lodash-es/isUndefined';
import { useEffect } from 'react';
import {
  channelLoader,
  editProgrammingLoader,
} from '../preloaders/channelLoaders.ts';
import { setCurrentChannel } from '../store/channelEditor/actions.ts';
import { usePreloadedData } from './preloadedDataHook.ts';
import { useChannelEditor } from '../store/selectors.ts';

export const usePreloadedChannel = () => {
  const channel = usePreloadedData(channelLoader);
  // Channel loader should've already set the state.
  return channel;
};

export const usePreloadedChannelEdit = () => {
  const { channel: preloadChannel, programming: preloadLineup } =
    usePreloadedData(editProgrammingLoader);
  const channelEditor = useChannelEditor();

  useEffect(() => {
    if (
      isUndefined(channelEditor.originalEntity) ||
      preloadChannel.id !== channelEditor.originalEntity.id
    ) {
      setCurrentChannel(preloadChannel, preloadLineup);
    }
  }, [channelEditor, preloadChannel, preloadLineup]);

  return channelEditor;
};
