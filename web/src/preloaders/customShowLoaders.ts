import { QueryClient } from '@tanstack/react-query';
import { CustomProgram, CustomShow } from '@tunarr/types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { getApiClient } from '../components/TunarrApiContext.tsx';
import { UnsavedId } from '../helpers/constants.ts';
import { createPreloader } from '../helpers/preloaderUtil.ts';
import {
  customShowProgramsQuery,
  customShowQuery,
  customShowsQuery,
} from '../hooks/useCustomShows.ts';
import { setCurrentCustomShow } from '../store/channelEditor/actions.ts';
import { Preloader } from '../types/index.ts';

export type CustomShowPreload = {
  show: CustomShow;
  programs: CustomProgram[];
};

export const customShowLoader = (isNew: boolean): Preloader<CustomShow> => {
  if (!isNew) {
    return createPreloader((apiClient, { params }) =>
      customShowQuery(apiClient, params.id!),
    );
  } else {
    return () => () => {
      const customShow = {
        id: UnsavedId,
        name: 'New Custom Show',
        contentCount: 0,
        totalDuration: 0,
      };
      return Promise.resolve(customShow);
    };
  }
};

export const newCustomShowLoader: Preloader<CustomShowPreload> =
  (queryClient: QueryClient) => (args: LoaderFunctionArgs) => {
    return customShowLoader(true)(queryClient)(args).then((show) => ({
      show,
      programs: [],
    }));
  };

export const existingCustomShowLoader: Preloader<CustomShowPreload> = (
  queryClient: QueryClient,
) => {
  const showLoader = customShowLoader(false)(queryClient);

  return async (args: LoaderFunctionArgs) => {
    const showLoaderPromise = showLoader(args);
    const programQuery = customShowProgramsQuery(
      getApiClient(),
      args.params.id!,
    );

    const programsPromise = queryClient.ensureQueryData(programQuery);

    return await Promise.all([showLoaderPromise, programsPromise]).then(
      ([show, programs]) => {
        setCurrentCustomShow(show, programs);
        return {
          show,
          programs,
        };
      },
    );
  };
};
export const customShowsLoader: Preloader<CustomShow[]> = createPreloader(() =>
  customShowsQuery(getApiClient()),
);
