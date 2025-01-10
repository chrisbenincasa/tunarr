import { AddProgrammingContextProvider } from '@/components/base/AddProgrammingContextProvider.tsx';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentCustomShow } from '@/store/customShowEditor/actions';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/custom-shows/new/programming')({
  component: CustomShowProgrammingSelectorPage,
});

function CustomShowProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  return (
    <AddProgrammingContextProvider
      onAddSelectedMedia={addMediaToCurrentCustomShow}
      onAddMediaSuccess={() => navigate({ to: '..' })}
    >
      <ProgrammingSelectorPage />
    </AddProgrammingContextProvider>
  );
}
