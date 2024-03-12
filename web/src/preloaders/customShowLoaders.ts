import { QueryClient } from '@tanstack/react-query';
import { CustomShow, CustomShowProgramming } from '@tunarr/types';
import { LoaderFunctionArgs } from 'react-router-dom';
import { createPreloader } from '../helpers/preloaderUtil.ts';
import {
  customShowProgramsQuery,
  customShowQuery,
  customShowsQuery,
} from '../hooks/useCustomShows.ts';
import { setCurrentCustomShow } from '../store/channelEditor/actions.ts';
import { Preloader } from '../types/index.ts';

export const customShowLoader = (isNew: boolean) => {
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

    const programsPromise = queryClient.ensureQueryData(programQuery);

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
export const customShowsLoader: Preloader<CustomShow[]> = createPreloader(() =>
  customShowsQuery(),
);
