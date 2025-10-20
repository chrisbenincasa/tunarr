import { createFileRoute } from '@tanstack/react-router';
import { LibraryBrowser } from '../../../components/library/LibraryBrowser.tsx';
import { MediaSourceLibraryQueryOpts } from '../../../hooks/media-sources/mediaSourceLibraryHooks.ts';

export const Route = createFileRoute(
  '/media_sources_/$mediaSourceId/libraries_/$libraryId',
)({
  component: MediaSourceBrowserPage,
  loader: ({ context, params: { libraryId } }) => {
    return context.queryClient.ensureQueryData(
      MediaSourceLibraryQueryOpts(libraryId),
    );
  },
});

function MediaSourceBrowserPage() {
  const { mediaSourceId, libraryId } = Route.useParams();
  return <LibraryBrowser mediaSourceId={mediaSourceId} libraryId={libraryId} />;
}
