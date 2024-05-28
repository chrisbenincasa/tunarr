import { QueryClient } from '@tanstack/react-query';
import {
  CustomShowProgramming,
  FillerList,
  FillerListProgramming,
} from '@tunarr/types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { getApiClient } from '../components/TunarrApiContext.tsx';
import { createPreloader } from '../helpers/preloaderUtil.ts';
import {
  fillerListProgramsQuery,
  fillerListQuery,
  fillerListsQuery,
} from '../hooks/useFillerLists.ts';
import { setCurrentFillerList } from '../store/channelEditor/actions.ts';
import { Preloader } from '../types/index.ts';

export const fillerListsLoader = createPreloader((apiClient) =>
  fillerListsQuery(apiClient),
);

const fillerListLoader = (isNew: boolean) => {
  if (!isNew) {
    return createPreloader(
      (apiClient, { params }) => fillerListQuery(apiClient, params.id!),
      (filler) => setCurrentFillerList(filler, []),
    );
  } else {
    return () => () => {
      const filler = {
        id: 'unsaved',
        name: 'New Filler List',
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
    const programQuery = fillerListProgramsQuery(
      getApiClient(),
      args.params.id!,
    );

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
