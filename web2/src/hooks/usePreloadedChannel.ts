import { useEffect } from 'react';
import { editProgrammingLoader } from '../pages/channels/loaders.ts';
import useStore from '../store/index.ts';
import { usePreloadedData } from './preloadedDataHook.ts';
import isUndefined from 'lodash-es/isUndefined';
import { setCurrentChannel } from '../store/channelEditor/actions.ts';

export const usePreloadedChannel = () => {
  const { channel: preloadChannel, lineup: preloadLineup } = usePreloadedData(
    editProgrammingLoader,
  );
  const channelEditor = useStore((s) => s.channelEditor);

  useEffect(() => {
    if (
      isUndefined(channelEditor.originalEntity) ||
      preloadChannel.number !== channelEditor.originalEntity.number
    ) {
      setCurrentChannel(preloadChannel, preloadLineup);
    }
  }, [channelEditor, preloadChannel, preloadLineup]);

  return channelEditor;
};
