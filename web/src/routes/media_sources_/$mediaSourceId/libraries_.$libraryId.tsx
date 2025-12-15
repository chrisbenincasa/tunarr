import { Box, Stack, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { LibraryProgramGrid } from '../../../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../../../components/library/SearchInput.tsx';
import {
  MediaSourceLibraryQueryOpts,
  useMediaSourceLibrary,
} from '../../../hooks/media-sources/mediaSourceLibraryHooks.ts';

export const Route = createFileRoute(
  '/media_sources_/$mediaSourceId/libraries_/$libraryId',
)({
  component: MediaSourceBrowserPage,
  loader: async ({ context, params: { libraryId } }) => {
    await context.queryClient.ensureQueryData(
      MediaSourceLibraryQueryOpts(libraryId),
    );
  },
});

function MediaSourceBrowserPage() {
  const { libraryId } = Route.useParams();
  const { data: library } = useMediaSourceLibrary(libraryId);

  return (
    <Box>
      {/* <Breadcrumbs /> */}
      <Box sx={{ mb: 2 }}>
        <Typography variant="h4">
          Media Source: "{library.mediaSource.name}"
        </Typography>
        <Typography variant="subtitle1">Library: {library.name}</Typography>
      </Box>
      <Stack gap={2}>
        <SearchInput
          mediaSource={library.mediaSource}
          library={library}
          disableProgramSelection
        />
        <LibraryProgramGrid
          mediaSource={library.mediaSource}
          library={library}
        />
      </Stack>
    </Box>
  );
}
