import { channelProgrammingQuery } from '@/hooks/useChannelLineup';
import { channelQuery } from '@/hooks/useChannels';
import { safeSetCurrentChannel } from '@/store/channelEditor/actions';
import { RouterContext } from '@/types/RouterContext';
import useStore from '@/store';
import { notFound } from '@tanstack/react-router';

type Args = {
  params: { channelId: string };
  context: RouterContext;
};
export async function preloadChannelAndProgramming({ params, context }: Args) {
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
