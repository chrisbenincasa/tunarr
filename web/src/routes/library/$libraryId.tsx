import { createFileRoute } from '@tanstack/react-router';
import { LibraryBrowser } from '../../components/library/LibraryBrowser.tsx';
import { MediaSourceLibraryQueryOpts } from '../../hooks/media-sources/mediaSourceLibraryHooks.ts';

export const Route = createFileRoute('/library/$libraryId')({
  staticData: {
    name: 'X',
  },
  component: LibraryBrowserPage,
  loader: ({ context, params: { libraryId } }) => {
    return context.queryClient.ensureQueryData(
      MediaSourceLibraryQueryOpts(libraryId),
    );
  },
});

function LibraryBrowserPage() {
  const { libraryId } = Route.useParams();
  return <LibraryBrowser libraryId={libraryId} />;
}
