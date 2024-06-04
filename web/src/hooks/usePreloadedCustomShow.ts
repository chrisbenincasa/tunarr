import { useLoaderData } from 'react-router-dom';
import { CustomShowPreload } from '../preloaders/customShowLoaders';
import { useCustomShowWithInitialData } from './useCustomShows';
import { UnsavedId } from '../helpers/constants';
import { useTunarrApi } from './useTunarrApi';
import { useCustomShowEditor } from '../store/selectors';
import { setCurrentCustomShow } from '../store/channelEditor/actions';

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
