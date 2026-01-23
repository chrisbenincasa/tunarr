import { Box, Stack, Typography } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { ProgramViewToggleButton } from '../../../components/base/ProgramViewToggleButton.tsx';
import Breadcrumbs from '../../../components/Breadcrumbs.tsx';
import { LibraryProgramGrid } from '../../../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../../../components/search/SearchInput.tsx';
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
        <Typography variant="h4" sx={{ display: 'inline-flex', width: '100%' }}>
          <span>Media Source: "{mediaSource.name}"</span>
          <ProgramViewToggleButton sx={{ ml: { sm: undefined, md: 'auto' } }} />
        </Typography>
        <Typography>
          Search is currently scoped to this Media Source.
        </Typography>
      </Box>
      <Stack gap={2}>
        <SearchInput />
        <LibraryProgramGrid mediaSource={mediaSource} disableProgramSelection />
      </Stack>
    </Box>
  );
}
