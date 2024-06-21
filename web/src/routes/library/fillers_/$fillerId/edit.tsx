import {
  fillerListProgramsQuery,
  fillerListQuery,
} from '@/hooks/useFillerLists';
import EditFillerPage from '@/pages/library/EditFillerPage';
import useStore from '@/store';
import { setCurrentFillerList } from '@/store/fillerListEditor/action';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/fillers/$fillerId/edit')({
  loader: async ({
    context: { queryClient, tunarrApiClientProvider },
    params: { fillerId },
  }) => {
    const apiClient = tunarrApiClientProvider();

    // TODO if this is too slow we can use the router defer method
    const [fillerList, programming] = await Promise.all([
      queryClient.ensureQueryData(fillerListQuery(apiClient, fillerId)),
      queryClient.ensureQueryData(fillerListProgramsQuery(apiClient, fillerId)),
    ]);

    // TODO handle not found

    // Set state
    const currentList = useStore.getState().fillerListEditor.currentEntity;
    if (currentList?.id !== fillerList.id) {
      setCurrentFillerList(fillerList, programming);
    }

    return {
      fillerList,
      programming,
    };
  },
  component: EditFillerPage,
});
