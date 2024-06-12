import { QueryClient } from '@tanstack/react-query';
import { Channel, CondensedChannelProgramming } from '@tunarr/types';
import dayjs from 'dayjs';
import { isNil, maxBy } from 'lodash-es';
import { LoaderFunctionArgs } from '@tanstack/react-router';
import { v4 as uuidv4 } from 'uuid';
import { getApiClient } from '../components/TunarrApiContext.tsx';
import { createPreloader } from '../helpers/preloaderUtil.ts';
import { channelProgrammingQuery } from '../hooks/useChannelLineup.ts';
import { channelQuery, channelsQuery } from '../hooks/useChannels.ts';
import {
  setCurrentChannel,
  setCurrentChannelProgramming,
} from '../store/channelEditor/actions.ts';
import useStore from '../store/index.ts';
import { Preloader } from '../types/index.ts';

// Default channel values that aren't dynamic
export const DefaultChannel = {
  duration: 0,
  icon: {
    duration: 0,
    path: '',
    position: 'bottom-right',
    width: 0,
  },
  guideMinimumDuration: 30000,
  fillerRepeatCooldown: 30,
  groupTitle: 'tunarr',
  stealth: false,
  disableFillerOverlay: false,
  offline: {
    mode: 'pic',
    // TODO: Make this work with the backend settings
    picture: 'http://localhost:8000/images/generic-offline-screen.png',
    soundtrack: '',
  },
} as const;

export function defaultNewChannel(num: number): Channel {
  return {
    id: uuidv4(),
    name: `Channel ${num}`,
    number: num,
    startTime: dayjs().add(1, 'h').startOf('h').unix() * 1000,
    ...DefaultChannel,
  };
}

// Returns whether the state was updated
function updateChannelState(
  channel: Channel,
  programming?: CondensedChannelProgramming,
): boolean {
  const currentState = useStore.getState().channelEditor;

  // Only set state on initial load
  if (
    isNil(currentState.originalEntity) ||
    channel.id !== currentState.originalEntity.id
  ) {
    setCurrentChannel(channel, programming);
    return true;
  }

  return false;
}

export const channelLoader: Preloader<Channel> = createPreloader(
  (apiClient, { params }) => channelQuery(apiClient, params.id!),
  updateChannelState,
);

// A preloader to load the details necessary to edit a channel itself
export const editChannelLoader = (isNew: boolean): Preloader<Channel> => {
  if (isNew) {
    return (queryClient) => async (args) => {
      const channels = await createPreloader((apiClient) =>
        channelsQuery(apiClient),
      )(queryClient)(args);

      const newChannel = defaultNewChannel(
        (maxBy(channels, (c) => c.number)?.number ?? 0) + 1,
      );

      updateChannelState(newChannel);

      return newChannel;
    };
  } else {
    return channelLoader;
  }
};

// A preloader to load the details necessary for editing a channel's programming
export const editProgrammingLoader: Preloader<{
  channel: Channel;
  programming: CondensedChannelProgramming;
}> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const apiClient = getApiClient();
    const lineupQueryOpts = channelProgrammingQuery(
      apiClient,
      params.id!,
      true,
    );
    const channelQueryOpts = channelQuery(apiClient, params.id!);

    const lineupPromise = queryClient.ensureQueryData(lineupQueryOpts);
    const channelPromise = queryClient.ensureQueryData(channelQueryOpts);

    return await Promise.all([channelPromise, lineupPromise]).then(
      ([channel, programming]) => {
        const currentState = useStore.getState().channelEditor;

        // Handle the case where a channel was preloaded, but its programming was not
        if (
          !updateChannelState(channel, programming) &&
          !currentState.programsLoaded
        ) {
          setCurrentChannelProgramming(programming);
        }

        return {
          channel,
          programming,
        };
      },
    );
  };
