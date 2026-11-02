import { invalidateTaggedQueries } from '@/helpers/queryUtil.ts';
import { useTranscodeConfigs } from '@/hooks/settingsHooks.ts';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import type { Channel } from '@tunarr/types';
import { useCallback, useEffect, useState } from 'react';
import { ChannelMenuButton } from '../../components/channels/ChannelMenuButton.tsx';
import { ChannelSessionsDialog } from '../../components/channels/ChannelSessionsDialog.tsx';
import { ChannelsView } from '../../components/channels/ChannelsView.tsx';
import { useChannelsNowPlaying } from '../../components/channels/useChannelsNowPlaying.ts';
import type { CollectionLayout } from '../../components/ui/patterns/CollectionView/index.ts';
import { useChannelsSuspense } from '../../hooks/useChannels.ts';
import { useServerEvents } from '../../hooks/useServerEvents.ts';

export default function ChannelsPage() {
  const { data: channels } = useChannelsSuspense({
    refetchOnWindowFocus: true,
  });
  const { data: transcodeConfigs } = useTranscodeConfigs();
  const nowPlaying = useChannelsNowPlaying();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [sessionsChannel, setSessionsChannel] = useState<Channel | null>(null);
  const { addListener, removeListener } = useServerEvents();

  useEffect(() => {
    const key = addListener((ev) => {
      if (ev.type === 'stream') {
        queryClient
          .invalidateQueries({
            predicate: invalidateTaggedQueries('Channels'),
          })
          .catch(console.error);
      }
    });
    return () => {
      removeListener(key);
    };
  }, [addListener, queryClient, removeListener]);

  const openChannel = useCallback(
    (channel: Channel) => {
      navigate({
        to: '/channels/$channelId',
        params: { channelId: channel.id },
      }).catch(console.error);
    },
    [navigate],
  );

  // Each layout shows some actions as buttons, so its menu leaves them out.
  const renderMenu = useCallback(
    (channel: Channel, place: CollectionLayout) => (
      <ChannelMenuButton
        channel={channel}
        hideItems={place === 'table' ? ['edit'] : ['watch', 'programming']}
      />
    ),
    [],
  );

  return (
    <>
      <ChannelsView
        channels={channels}
        nowPlaying={nowPlaying}
        transcodeConfigs={transcodeConfigs ?? []}
        onOpenChannel={openChannel}
        onOpenSessions={setSessionsChannel}
        renderMenu={renderMenu}
      />
      <ChannelSessionsDialog
        open={sessionsChannel !== null}
        onClose={() => setSessionsChannel(null)}
        channel={sessionsChannel}
      />
    </>
  );
}
