import {
  type ChannelArgs,
  preloadChannelAndProgramming,
} from '@/helpers/routeLoaders';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions';
import { setPlexFilter } from '@/store/programmingSelector/actions';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';
import { z } from 'zod/v4';
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

function ChannelProgrammingSelectorPage() {
  const navigate = Route.useNavigate();
  const { mediaSourceId, libraryId } = Route.useSearch();
  return (
    <ProgrammingSelectionContext.Provider
      value={{
        onAddSelectedMedia: addMediaToCurrentChannel,
        onAddMediaSuccess: useCallback(() => {
          navigate({ to: '..' }).catch(console.error);
        }, [navigate]),
        entityType: 'channel',
      }}
    >
      <ProgrammingSelectorPage
        initialMediaSourceId={mediaSourceId}
        initialLibraryId={libraryId}
      />
    </ProgrammingSelectionContext.Provider>
  );
}
