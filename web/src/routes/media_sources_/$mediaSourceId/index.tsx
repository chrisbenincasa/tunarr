import { Box, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import Breadcrumbs from '../../../components/Breadcrumbs.tsx';
import { LibrarySearch } from '../../../components/library/LibrarySearch.tsx';
import { getApiMediaSourcesByMediaSourceIdOptions } from '../../../generated/@tanstack/react-query.gen.ts';
import { useMediaSource } from '../../../hooks/media-sources/mediaSourceHooks.ts';
import { setSearchRequest } from '../../../store/programmingSelector/actions.ts';

export const Route = createFileRoute('/media_sources_/$mediaSourceId/')({
  component: MediaSourceBrowserPage,
  loader: async ({ context, params: { mediaSourceId } }) => {
    await context.queryClient.ensureQueryData(
      getApiMediaSourcesByMediaSourceIdOptions({
        path: {
          mediaSourceId,
        },
      }),
    );
    setSearchRequest(null);
  },
});

function MediaSourceBrowserPage() {
  const { mediaSourceId } = Route.useParams();
  const { data: mediaSource } = useMediaSource(mediaSourceId);

  return (
    <Box>
      <Breadcrumbs thisRouteName={mediaSource.name} />
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4">Media Source: "{mediaSource.name}"</Typography>
        <Typography>
          Search is currently scoped to this Media Source.
        </Typography>
      </Box>
      <LibrarySearch mediaSource={mediaSource} disableProgramSelection />
    </Box>
  );
}
