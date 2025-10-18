import { UnsavedId } from '@/helpers/constants';
import { NewFillerPage } from '@/pages/library/NewFillerPage';
import useStore from '@/store';
import { setCurrentFillerList } from '@/store/fillerListEditor/action';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/fillers_/new/')({
  loader: () => {
    const unsavedData = {
      fillerList: {
        id: UnsavedId,
        name: 'New Filler List',
        contentCount: 0,
      },
      programming: [],
    };

    // Do we need to compare to make sure we don't clobber state...??
    const existingNewFiller =
      useStore.getState().fillerListEditor.currentEntity;
    if (existingNewFiller?.id !== UnsavedId) {
      setCurrentFillerList(unsavedData.fillerList, []);
    }

    return unsavedData;
  },
  component: NewFillerPage,
});
