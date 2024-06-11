import { useLoaderData } from 'react-router-dom';
import { UnsavedId } from '../helpers/constants';
import { CustomShowPreload } from '../preloaders/customShowLoaders';
import { setCurrentCustomShow } from '../store/channelEditor/actions';
import { useCustomShowEditor } from '../store/selectors';
import { useCustomShowWithInitialData } from './useCustomShows';
import { useTunarrApi } from './useTunarrApi';

export const usePreloadedCustomShow = () => {
  const apiClient = useTunarrApi();
  const { show: preloadShow, programs: preloadPrograms } =
    useLoaderData() as CustomShowPreload;

  const [customShow, customPrograms] = useCustomShowWithInitialData(
    apiClient,
    preloadShow.id,
    preloadShow.id !== UnsavedId,
    {
      customShow: preloadShow,
      programs: preloadPrograms,
    },
  );

  const customShowEditor = useCustomShowEditor();

  if (customShowEditor.currentEntity?.id !== customShow.data.id) {
    setCurrentCustomShow(customShow.data, customPrograms.data);
  }

  return customShowEditor;
};
