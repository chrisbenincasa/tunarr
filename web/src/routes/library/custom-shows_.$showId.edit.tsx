import {
  customShowProgramsQuery,
  customShowQuery,
} from '@/hooks/useCustomShows';
import EditCustomShowPage from '@/pages/library/EditCustomShowPage';
import useStore from '@/store';
import { setCurrentCustomShow } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/custom-shows/$showId/edit')({
  loader: async ({
    context: { queryClient, tunarrApiClientProvider },
    params: { showId },
  }) => {
    const apiClient = tunarrApiClientProvider();

    // TODO if this is too slow we can use the router defer method
    const [customShow, programming] = await Promise.all([
      queryClient.ensureQueryData(customShowQuery(apiClient, showId)),
      queryClient.ensureQueryData(customShowProgramsQuery(apiClient, showId)),
    ]);

    // TODO handle not found

    // Set state
    const currentShow = useStore.getState().fillerListEditor.currentEntity;
    if (currentShow?.id !== customShow.id) {
      setCurrentCustomShow(customShow, programming);
    }

    return {
      customShow,
      programming,
    };
  },
  component: EditCustomShowPage,
});
