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
  FillerList,
  FillerListProgramming,
} from '@tunarr/types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { lineupQuery } from '../../hooks/useChannelLineup.ts';
import { channelQuery, channelsQuery } from '../../hooks/useChannels.ts';
import {
  customShowProgramsQuery,
  customShowQuery,
  customShowsQuery,
} from '../../hooks/useCustomShows.ts';
import {
  setCurrentChannel,
  setCurrentCustomShow,
  setCurrentFillerList,
} from '../../store/channelEditor/actions.ts';
import { Preloader } from '../../types/index.ts';
import {
  fillerListProgramsQuery,
  fillerListQuery,
} from '../../hooks/useFillerLists.ts';

function createPreloader<
  T = unknown,
  QK extends QueryKey = QueryKey,
  TInferred = QK extends DataTag<ReadonlyArray<unknown>, infer TData>
    ? TData
    : T,
>(
  query: (
    args: LoaderFunctionArgs,
  ) => UseQueryOptions<TInferred, Error, TInferred, QK>,
  callback: (data: TInferred) => void = () => {},
): Preloader<TInferred> {
  return (queryClient: QueryClient) => async (args) => {
    const qk = query(args);
    let data: TInferred | undefined = queryClient.getQueryData(qk.queryKey);
    if (!data) {
      data = await queryClient.fetchQuery(qk);
    }
    callback(data);
    return data;
  };
}

export const editChannelLoader = createPreloader<Channel>(
  ({ params }) => channelQuery(params.id!),
  (channel) => setCurrentChannel(channel, []),
);

export const editProgrammingLoader: Preloader<{
  channel: Channel;
  lineup: ChannelProgram[];
}> =
  (queryClient: QueryClient) =>
  async ({ params }: LoaderFunctionArgs) => {
    const lineupQueryData = lineupQuery(params.id!, null, true);
    const channelQueryData = channelQuery(params.id!);

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
  () => customShowsQuery,
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

const fillerListLoader = (isNew: boolean) => {
  if (!isNew) {
    return createPreloader(
      ({ params }) => fillerListQuery(params.id!),
      (filler) => setCurrentFillerList(filler, []),
    );
  } else {
    return () => () => {
      const filler = {
        id: 'unsaved',
        name: 'New',
        contentCount: 0,
      };
      setCurrentFillerList(filler, []);
      return Promise.resolve(filler);
    };
  }
};

export const newFillerListLoader: Preloader<{
  filler: FillerList;
  programs: FillerListProgramming;
}> = (queryClient: QueryClient) => (args: LoaderFunctionArgs) => {
  return fillerListLoader(true)(queryClient)(args).then((filler) => ({
    filler,
    programs: [],
  }));
};

export const existingFillerListLoader: Preloader<{
  filler: FillerList;
  programs: CustomShowProgramming;
}> = (queryClient: QueryClient) => {
  const showLoader = fillerListLoader(false)(queryClient);

  return async (args: LoaderFunctionArgs) => {
    const showLoaderPromise = showLoader(args);
    const programQuery = fillerListProgramsQuery(args.params.id!);

    const programsPromise = Promise.resolve(
      queryClient.getQueryData(programQuery.queryKey),
    ).then((programs) => {
      return programs ?? queryClient.fetchQuery(programQuery);
    });

    return await Promise.all([showLoaderPromise, programsPromise]).then(
      ([filler, programs]) => {
        setCurrentFillerList(filler, programs);
        return {
          filler,
          programs,
        };
      },
    );
  };
};
