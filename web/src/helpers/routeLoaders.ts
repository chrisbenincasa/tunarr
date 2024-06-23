import { channelProgrammingQuery } from '@/hooks/useChannelLineup';
import { channelQuery } from '@/hooks/useChannels';
import {
  fillerListProgramsQuery,
  fillerListQuery,
} from '@/hooks/useFillerLists.ts';
import useStore from '@/store';
import { safeSetCurrentChannel } from '@/store/channelEditor/actions';
import { setCurrentFillerList } from '@/store/fillerListEditor/action.ts';
import { RouterContext } from '@/types/RouterContext';
import { notFound } from '@tanstack/react-router';

type ChannelArgs = {
  params: { channelId: string };
  context: RouterContext;
};

export async function preloadChannelAndProgramming({
  params,
  context,
}: ChannelArgs) {
  const currentProgram = useStore.getState().channelEditor.currentEntity;

  if (currentProgram?.id === params.channelId) {
    return;
  }

  const [channel, programming] = await Promise.allSettled([
    context.queryClient.ensureQueryData(
      channelQuery(context.tunarrApiClientProvider(), params.channelId),
    ),
    context.queryClient.ensureQueryData(
      channelProgrammingQuery(
        context.tunarrApiClientProvider(),
        params.channelId,
        true,
      ),
    ),
  ]);

  if (channel.status === 'rejected' || programming.status === 'rejected') {
    // Check if it's a not found or what...
    console.error(channel, programming);
    throw notFound();
  }

  safeSetCurrentChannel(channel.value, programming.value);
}

type FillerArgs = {
  params: { fillerId: string };
  context: RouterContext;
};

export async function preloadFillerAndProgramming({
  context: { queryClient, tunarrApiClientProvider },
  params: { fillerId },
}: FillerArgs) {
  const apiClient = tunarrApiClientProvider();

  // TODO if this is too slow we can use the router defer method
  const [fillerList, programming] = await Promise.all([
    queryClient.ensureQueryData(fillerListQuery(apiClient, fillerId)),
    queryClient.ensureQueryData(fillerListProgramsQuery(apiClient, fillerId)),
  ]);

  // TODO handle not found

  // Set state
  const currentList = useStore.getState().fillerListEditor.currentEntity;
  if (currentList?.id !== fillerList.id) {
    setCurrentFillerList(fillerList, programming);
  }

  return {
    fillerList,
    programming,
  };
}
