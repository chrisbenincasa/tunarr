import { UnsavedId } from '@/helpers/constants';
import { NewCustomShowPage } from '@/pages/library/NewCustomShowPage';
import useStore from '@/store';
import { setCurrentCustomShow } from '@/store/customShowEditor/actions';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/custom-shows_/new/')({
  loader() {
    const customShow = {
      id: UnsavedId,
      name: '',
      contentCount: 0,
      totalDuration: 0,
    };

    const existingNewFiller =
      useStore.getState().customShowEditor.currentEntity;
    if (existingNewFiller?.id !== UnsavedId) {
      setCurrentCustomShow(customShow, []);
    }

    return {
      customShow,
      programming: [],
    };
  },
  component: NewCustomShowPage,
});
