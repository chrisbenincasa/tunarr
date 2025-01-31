import {
  type ChannelArgs,
  preloadChannelAndProgramming,
} from '@/helpers/routeLoaders';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions';
import { setPlexFilter } from '@/store/programmingSelector/actions';
import { createFileRoute } from '@tanstack/react-router';
import { z } from 'zod';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

const channelProgrammingSchema = z.object({
  mediaSourceId: z.string().optional().catch(undefined),
  libraryId: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/channels/$channelId/programming/add')({
  validateSearch: (search) => channelProgrammingSchema.parse(search),
  loader: (args: ChannelArgs) =>
    preloadChannelAndProgramming(args).then(() => {
      setPlexFilter(undefined);
    }),
  component: ChannelProgrammingSelectorPage,
});

type Props = {
  initialMediaSourceId?: string;
  initialLibraryId?: string;
};

function ChannelProgrammingSelectorPage({
  initialMediaSourceId,
  initialLibraryId,
}: Props) {
  const navigate = Route.useNavigate();
  return (
    <ProgrammingSelectionContext.Provider
      value={{
        onAddSelectedMedia: addMediaToCurrentChannel,
        onAddMediaSuccess: () => {
          navigate({ to: '..' }).catch(console.error);
        },
        entityType: 'channel',
      }}
    >
      <ProgrammingSelectorPage
        initialMediaSourceId={initialMediaSourceId}
        initialLibraryId={initialLibraryId}
      />
    </ProgrammingSelectionContext.Provider>
  );
}
