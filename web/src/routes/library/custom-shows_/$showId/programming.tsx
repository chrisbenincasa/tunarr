import { AddProgrammingContextProvider } from '@/components/base/AddProgrammingContextProvider.tsx';
import { preloadCustomShowAndProgramming } from '@/helpers/routeLoaders.ts';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage.tsx';
import { addMediaToCurrentCustomShow } from '@/store/customShowEditor/actions.ts';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute(
  '/library/custom-shows/$showId/programming',
)({
  loader: preloadCustomShowAndProgramming,
  component: CustomShowProgrammingSelectorPage,
});

function CustomShowProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  const { showId } = Route.useParams();
  return (
    <AddProgrammingContextProvider
      onAddSelectedMedia={addMediaToCurrentCustomShow}
      onAddMediaSuccess={() =>
        navigate({
          to: '/library/custom-shows/$showId/edit',
          params: { showId },
        })
      }
    >
      <ProgrammingSelectorPage />
    </AddProgrammingContextProvider>
  );
}
