import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions';
import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/channels/$channelId/programming/add')({
  component: ChannelProgrammingSelectorPage,
});

function ChannelProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  return (
    <ProgrammingSelectorPage
      onAddSelectedMedia={addMediaToCurrentChannel}
      onAddMediaSuccess={() => navigate({ to: '..' })}
    />
  );
}
