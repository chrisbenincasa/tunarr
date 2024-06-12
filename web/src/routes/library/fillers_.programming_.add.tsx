import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentFillerList } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/fillers/programming/add')({
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
