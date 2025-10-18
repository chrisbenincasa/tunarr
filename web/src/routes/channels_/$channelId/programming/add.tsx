import {
  type ChannelArgs,
  preloadChannelAndProgramming,
} from '@/helpers/routeLoaders';
import ProgrammingSelectorPage from '@/pages/channels/ProgrammingSelectorPage';
import { addMediaToCurrentChannel } from '@/store/channelEditor/actions';
import { setPlexFilter } from '@/store/programmingSelector/actions';
import { createFileRoute } from '@tanstack/react-router';
import { SearchRequest, SearchRequestSchema } from '@tunarr/types/api';
import { useCallback, useMemo } from 'react';
import { z } from 'zod/v4';
import { ProgrammingSelectionContext } from '../../../../context/ProgrammingSelectionContext.ts';

const channelProgrammingSchema = z.object({
  mediaSourceId: z.string().optional().catch(undefined),
  libraryId: z.string().optional().catch(undefined),
  searchRequest: z.base64().optional().catch(undefined),
});

export const Route = createFileRoute('/channels_/$channelId/programming/add')({
  validateSearch: (search) => channelProgrammingSchema.parse(search),
  loader: (args: ChannelArgs) =>
    preloadChannelAndProgramming(args).then(() => {
      setPlexFilter(undefined);
    }),
  component: ChannelProgrammingSelectorPage,
});

function ChannelProgrammingSelectorPage() {
  const search = Route.useSearch();
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
        onMediaSourceChange: useCallback(
          (mediaSourceId: string) =>
            navigate({ search: { ...search, mediaSourceId } }),
          [navigate, search],
        ),
        onLibraryChange: useCallback(
          (libraryId: string) => {
            navigate({ search: { ...search, libraryId } }).catch(console.error);
          },
          [navigate, search],
        ),
        onSearchChange: useCallback(
          (searchReq: SearchRequest) =>
            navigate({
              search: {
                ...search,
                searchRequest: btoa(JSON.stringify(searchReq)),
              },
            }).catch(console.error),
          [search, navigate],
        ),
      }}
    >
      <ProgrammingSelectorPage
        initialMediaSourceId={mediaSourceId}
        initialLibraryId={libraryId}
        initialSearchRequest={parsedSearchRequest}
      />
    </ProgrammingSelectionContext.Provider>
  );
}
