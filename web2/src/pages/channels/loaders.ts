import {
  DataTag,
  QueryClient,
  QueryKey,
  UseQueryOptions,
} from '@tanstack/react-query';
import {
  Channel,
  ChannelProgram,
  CustomShow,
  CustomShowProgramming,
} from '@tunarr/types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { lineupQuery } from '../../hooks/useChannelLineup.ts';
import { channelQuery, channelsQuery } from '../../hooks/useChannels.ts';
import {
  customShowProgramsQuery,
  customShowQuery,
  useCustomShowsQuery,
} from '../../hooks/useCustomShows.ts';
import {
  setCurrentChannel,
  setCurrentCustomShow,
} from '../../store/channelEditor/actions.ts';
import { Preloader } from '../../types/index.ts';

function createPreloader<T>(
  query: (
    args: LoaderFunctionArgs,
  ) => UseQueryOptions<T, Error, T, DataTag<QueryKey, T>>,
  callback: (data: T) => void = () => {},
): Preloader<T> {
  return (queryClient: QueryClient) => async (args) => {
    const qk = query(args);
    let data = queryClient.getQueryData(qk.queryKey);
    if (!data) {
      data = await queryClient.fetchQuery(qk);
    }
    callback(data);
    return data;
  };
}

export const editChannelLoader = createPreloader<Channel>(
  ({ params }) => channelQuery(parseInt(params.id!)),
  (channel) => setCurrentChannel(channel, []),
);

export const editProgrammingLoader: Preloader<{
  channel: Channel;
  lineup: ChannelProgram[];
}> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const lineupQueryData = lineupQuery(parseInt(params.id!), null, true);
    const channelQueryData = channelQuery(parseInt(params.id!));

    const lineupPromise = Promise.resolve(
      queryClient.getQueryData(lineupQueryData.queryKey),
    ).then((lineup) => {
      return lineup ?? queryClient.fetchQuery(lineupQueryData);
    });

    const channelPromise = Promise.resolve(
      queryClient.getQueryData(channelQueryData.queryKey),
    ).then((channel) => {
      return channel ?? queryClient.fetchQuery(channelQueryData);
    });

    return await Promise.all([channelPromise, lineupPromise]).then(
      ([channel, lineup]) => {
        return {
          channel,
          lineup: lineup.programs,
        };
      },
    );
  };

export const newChannelLoader: Preloader<Channel[]> = createPreloader(
  () => channelsQuery,
);

export const customShowsLoader: Preloader<CustomShow[]> = createPreloader(
  () => useCustomShowsQuery,
);

const customShowLoader = (isNew: boolean) => {
  if (!isNew) {
    return createPreloader(
      ({ params }) => customShowQuery(params.id!),
      (show) => setCurrentCustomShow(show, []),
    );
  } else {
    return () => () => {
      const customShow = {
        id: 'unsaved',
        name: 'New',
        contentCount: 0,
      };
      setCurrentCustomShow(customShow, []);
      return Promise.resolve(customShow);
    };
  }
};

export const newCustomShowLoader: Preloader<{
  show: CustomShow;
  programs: CustomShowProgramming;
}> = (queryClient: QueryClient) => (args: LoaderFunctionArgs) => {
  return customShowLoader(true)(queryClient)(args).then((show) => ({
    show,
    programs: [],
  }));
};

export const existingCustomShowLoader: Preloader<{
  show: CustomShow;
  programs: CustomShowProgramming;
}> = (queryClient: QueryClient) => {
  const showLoader = customShowLoader(false)(queryClient);

  return async (args: LoaderFunctionArgs) => {
    const showLoaderPromise = showLoader(args);
    const programQuery = customShowProgramsQuery(args.params.id!);

    const programsPromise = Promise.resolve(
      queryClient.getQueryData(programQuery.queryKey),
    ).then((programs) => {
      return programs ?? queryClient.fetchQuery(programQuery);
    });

    return await Promise.all([showLoaderPromise, programsPromise]).then(
      ([show, programs]) => {
        console.log(show, programs);
        setCurrentCustomShow(show, programs);
        return {
          show,
          programs,
        };
      },
    );
  };
};
