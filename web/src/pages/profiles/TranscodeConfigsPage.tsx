import { Trans, useLingui } from '@lingui/react/macro';
import { Paper, Stack, Typography } from '@mui/material';
import { TranscodeConfigsTable } from '../../components/settings/ffmpeg/TranscodeConfigsTable.tsx';

export default function TranscodeConfigsPage() {
  const { t } = useLingui();

  return (
    <Stack spacing={2}>
      <Typography variant="h3">
        <Trans>Transcoding Configs</Trans>
      </Typography>
      <Typography variant="body1">
        <Trans>
          Configure transcoding settings for Tunarr's streams. Each channel is
          assigned one transcode configuration.
        </Trans>
      </Typography>
      <Paper sx={{ p: [1, 2] }}>
        <TranscodeConfigsTable />
      </Paper>
    </Stack>
  );
}
