import { preloadFillerAndProgramming } from '@/helpers/routeLoaders.ts';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage.tsx';
import { addMediaToCurrentFillerList } from '@/store/fillerListEditor/action.ts';
import { createFileRoute } from '@tanstack/react-router';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

export const Route = createFileRoute('/library/fillers/$fillerId/programming')({
  loader: preloadFillerAndProgramming,
  component: FillerProgrammingSelectorPage,
});

function FillerProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  const { fillerId } = Route.useParams();
  return (
    <ProgrammingSelectionContext.Provider
      value={{
        onAddSelectedMedia: addMediaToCurrentFillerList,
        onAddMediaSuccess: () => {
          navigate({
            to: '/library/fillers/$fillerId/edit',
            params: { fillerId },
          }).catch(console.error);
        },
        entityType: 'filler-list',
      }}
    >
      <ProgrammingSelectorPage />
    </ProgrammingSelectionContext.Provider>
  );
}
