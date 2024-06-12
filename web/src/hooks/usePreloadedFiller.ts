import { FillerPreload } from '@/preloaders/fillerListLoader';
import { setCurrentFillerList } from '@/store/channelEditor/actions';
import { useLoaderData } from 'react-router-dom';
import { UnsavedId } from '../helpers/constants';
import { useFillerListEditor } from '../store/selectors';
import { useFillerListWithProgramming } from './useFillerLists';
import { useTunarrApi } from './useTunarrApi';

export const usePreloadedFiller = () => {
  const apiClient = useTunarrApi();
  const { filler: preloadFiller, programs: preloadPrograms } =
    useLoaderData() as FillerPreload;

  const [filler, fillerPrograms] = useFillerListWithProgramming(
    apiClient,
    preloadFiller.id,
    preloadFiller.id !== UnsavedId,
    {
      filler: preloadFiller,
      fillerListPrograms: preloadPrograms,
    },
  );

  const fillerListEditor = useFillerListEditor();

  if (fillerListEditor.currentEntity?.id !== filler.data.id) {
    setCurrentFillerList(filler.data, fillerPrograms.data);
  }

  return fillerListEditor;
};
