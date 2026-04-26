import { Trans } from '@lingui/react/macro';
import { Box, Stack, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { ProgramViewToggleButton } from '../../../components/base/ProgramViewToggleButton.tsx';
import { LibraryProgramGrid } from '../../../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../../../components/search/SearchInput.tsx';
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
        <Typography variant="h4" sx={{ display: 'inline-flex', width: '100%' }}>
          <span><Trans>Media Source: "{library.mediaSource.name}"</Trans></span>
          <ProgramViewToggleButton sx={{ ml: { sm: undefined, md: 'auto' } }} />
        </Typography>
        <Typography variant="subtitle1"><Trans>Library: {library.name}</Trans></Typography>
        <Typography variant="subtitle1">
          <Trans>Search is currently scoped to this Media Source Library.</Trans>
        </Typography>
      </Box>
      <Stack gap={2}>
        <SearchInput libraryId={libraryId} />
        <LibraryProgramGrid
          mediaSource={library.mediaSource}
          library={library}
          disableProgramSelection
        />
      </Stack>
    </Box>
  );
}
