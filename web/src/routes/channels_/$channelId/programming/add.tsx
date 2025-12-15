import {
  type ChannelArgs,
  preloadChannelAndProgramming,
} from '@/helpers/routeLoaders';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions';
import { setPlexFilter } from '@/store/programmingSelector/actions';
import { createFileRoute } from '@tanstack/react-router';
import { useCallback } from 'react';
import { noop } from 'ts-essentials';
import { z } from 'zod/v4';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';
import useStore from '../../../../store/index.ts';

const channelProgrammingSchema = z.object({
  mediaSourceId: z.string().optional().catch(undefined),
  libraryId: z.string().optional().catch(undefined),
});

export const Route = createFileRoute('/channels_/$channelId/programming/add')({
  validateSearch: (search) => channelProgrammingSchema.parse(search),
  loader: async (args: ChannelArgs) => {
    useStore.setState((s) => {
      s.currentSearchRequest = null;
    });
    await preloadChannelAndProgramming(args);
    setPlexFilter(undefined);
  },
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
        onSourceChange: useCallback(
          ({ mediaSourceId, libraryId }) => {
            navigate({
              search: (prev: z.infer<typeof channelProgrammingSchema>) => ({
                ...prev,
                mediaSourceId: mediaSourceId ?? prev.mediaSourceId,
                libraryId: libraryId ?? prev.libraryId,
              }),
            }).catch(console.error);
          },
          [navigate],
        ),
        onSearchChange: noop,
      }}
    >
      <ProgrammingSelectorPage
        initialMediaSourceId={mediaSourceId}
        initialLibraryId={libraryId}
        // initialSearchRequest={parsedSearchRequest}
      />
    </ProgrammingSelectionContext.Provider>
  );
}
