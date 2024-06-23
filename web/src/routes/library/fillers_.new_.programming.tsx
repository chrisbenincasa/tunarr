import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentFillerList } from '@/store/fillerListEditor/action';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/fillers/new/programming')({
  component: FillerProgrammingSelectorPage,
});

function FillerProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  return (
    <ProgrammingSelectorPage
      onAddSelectedMedia={addMediaToCurrentFillerList}
      onAddMediaSuccess={() => navigate({ to: '..' })}
    />
  );
}
