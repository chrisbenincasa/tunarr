import { preloadCustomShowAndProgramming } from '@/helpers/routeLoaders.ts';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage.tsx';
import { addMediaToCurrentCustomShow } from '@/store/customShowEditor/actions.ts';
import { createFileRoute } from '@tanstack/react-router';
import { noop } from 'ts-essentials';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

export const Route = createFileRoute(
  '/library/custom-shows_/$showId/programming',
)({
  loader: preloadCustomShowAndProgramming,
  component: CustomShowProgrammingSelectorPage,
});

function CustomShowProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  const { showId } = Route.useParams();
  return (
    <ProgrammingSelectionContext.Provider
      value={{
        onAddSelectedMedia: addMediaToCurrentCustomShow,
        onAddMediaSuccess: () => {
          navigate({
            to: '/library/custom-shows/$showId/edit',
            params: { showId },
          }).catch(console.error);
        },
        entityType: 'custom-show',
        onSourceChange: noop,
        onSearchChange: noop,
      }}
    >
      <ProgrammingSelectorPage />
    </ProgrammingSelectionContext.Provider>
  );
}
