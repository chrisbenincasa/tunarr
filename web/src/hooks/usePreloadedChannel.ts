import { useQueryClient } from '@tanstack/react-query';
import isUndefined from 'lodash-es/isUndefined';
import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  channelLoader,
  editProgrammingLoader,
} from '../preloaders/channelLoaders.ts';
import {
  resetCurrentLineup,
  setCurrentChannel,
} from '../store/channelEditor/actions.ts';
import { useChannelEditor } from '../store/selectors.ts';
import { usePreloadedData } from './preloadedDataHook.ts';
import { useChannelProgramming } from './useChannelLineup.ts';

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

export const useResetCurrentLineup = () => {
  const { id } = useParams();
  const { data: lineup } = useChannelProgramming(id!);
  const [isReset, setIsReset] = useState(false);

  const queryClient = useQueryClient();

  useEffect(() => {
    if (lineup && isReset) {
      console.log(lineup.lineup);
      resetCurrentLineup(lineup.lineup, lineup.programs);
      setIsReset(false);
    }
  }, [lineup, isReset, setIsReset]);

  return useCallback(() => {
    if (!isReset) {
      setIsReset(true);
      queryClient
        .invalidateQueries({
          exact: false,
          queryKey: ['channels', id!, 'programming'],
        })
        .catch(console.error);
    }
  }, [setIsReset, queryClient, isReset]);
};
