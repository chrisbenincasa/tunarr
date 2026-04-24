import { Trans } from '@lingui/react/macro';
import { Box, Stack, Typography, useMediaQuery, useTheme } from '@mui/material';
import { MediaSourceLibraryTable } from '../../components/MediaSourceLibraryTable.tsx';

export default function LibraryIndexPage() {
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box>
      <Typography variant={smallViewport ? 'h5' : 'h3'} mb={2}>
        <Trans>Library</Trans>
      </Typography>
      <Stack gap={2}>
        <MediaSourceLibraryTable />
      </Stack>
    </Box>
  );
}
