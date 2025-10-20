import { preloadFillerAndProgramming } from '@/helpers/routeLoaders.ts';
import EditFillerPage from '@/pages/library/EditFillerPage';
import { createFileRoute } from '@tanstack/react-router';
import { setCurrentEntityType } from '../../../../store/channelEditor/actions.ts';

export const Route = createFileRoute('/library/fillers_/$fillerId/edit')({
  loader: (context) => {
    setCurrentEntityType('filler');
    return preloadFillerAndProgramming(context);
  },
  component: EditFillerPage,
});
