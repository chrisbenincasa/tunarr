import {
  type ChannelArgs,
  preloadChannelAndProgramming,
} from '@/helpers/routeLoaders';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions';
import { setPlexFilter } from '@/store/programmingSelector/actions';
import type { ValidatorAdapter } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import type { SearchRequest } from '@tunarr/types/api';
import { SearchRequestSchema } from '@tunarr/types/api';
import { useCallback, useMemo } from 'react';
import { z } from 'zod/v4';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

const channelProgrammingSchema = z.object({
  mediaSourceId: z.string().optional().catch(undefined),
  libraryId: z.string().optional().catch(undefined),
  searchRequest: z.base64().optional().catch(undefined),
});

const validator = zodValidator({
  schema: channelProgrammingSchema,
});

type Params = {
  mediaSourceId?: string;
  libraryId?: string;
  searchRequest?: SearchRequest;
};

type Validator = ValidatorAdapter<
  z.infer<typeof channelProgrammingSchema>,
  Params
>;

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
  const { mediaSourceId, libraryId, searchRequest } = Route.useSearch();
  const parsedSearchRequest = useMemo(() => {
    if (searchRequest) {
      try {
        return SearchRequestSchema.parse(JSON.parse(atob(searchRequest)));
      } catch (e) {
        console.warn(e);
      }
    }
    return;
  }, [searchRequest]);
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
