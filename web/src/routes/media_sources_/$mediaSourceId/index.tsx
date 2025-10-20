import { createFileRoute } from '@tanstack/react-router';
import { LibraryBrowser } from '../../../components/library/LibraryBrowser.tsx';
import { getApiMediaSourcesByMediaSourceIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';

export const Route = createFileRoute('/media_sources_/$mediaSourceId/')({
  component: MediaSourceBrowserPage,
  loader: ({ context, params: { mediaSourceId } }) => {
    return context.queryClient.ensureQueryData(
      getApiMediaSourcesByMediaSourceIdOptions({
        path: {
          mediaSourceId,
        },
      }),
    );
  },
});

function MediaSourceBrowserPage() {
  const { mediaSourceId } = Route.useParams();
  return <LibraryBrowser mediaSourceId={mediaSourceId} />;
}
