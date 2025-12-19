import { Box, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { LibrarySearch } from '../../../components/library/LibrarySearch.tsx';
import {
  MediaSourceLibraryQueryOpts,
  useMediaSourceLibrary,
} from '../../../hooks/media-sources/mediaSourceLibraryHooks.ts';
import { setSearchRequest } from '../../../store/programmingSelector/actions.ts';

export const Route = createFileRoute(
  '/media_sources_/$mediaSourceId/libraries_/$libraryId',
)({
  component: MediaSourceBrowserPage,
  loader: async ({ context, params: { libraryId } }) => {
    await context.queryClient.ensureQueryData(
      MediaSourceLibraryQueryOpts(libraryId),
    );
    setSearchRequest(null);
  },
});

function MediaSourceBrowserPage() {
  const { libraryId } = Route.useParams();
  const { data: library } = useMediaSourceLibrary(libraryId);

  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4">
          Media Source: "{library.mediaSource.name}"
        </Typography>
        <Typography variant="subtitle1">Library: {library.name}</Typography>
      </Box>
      <LibrarySearch
        mediaSource={library.mediaSource}
        library={library}
        disableProgramSelection
      />
    </Box>
  );
}
