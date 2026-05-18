import { StreamSelectionProfilesTable } from '@/components/profiles/StreamSelectionProfilesTable';
import { Trans } from '@lingui/react/macro';
import { Box, Paper, Typography } from '@mui/material';

export default function StreamSelectionProfilesPage() {
  return (
    <Box>
      <Typography variant="h3" mb={2}>
        <Trans>Stream Selection Profiles</Trans>
      </Typography>
      <Typography variant="body1" sx={{ mb: 2 }}>
        <Trans>
          Stream selection profiles control which audio and subtitle streams are
          selected during transcoding. Assign profiles to channels, filler
          lists, or individual programs.
        </Trans>
      </Typography>
      <Paper sx={{ p: [1, 2] }}>
        <StreamSelectionProfilesTable />
      </Paper>
    </Box>
  );
}
