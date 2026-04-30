import { Plural, Trans } from '@lingui/react/macro';
import { PlaylistAdd } from '@mui/icons-material';
import { Button, Paper, Stack, Typography } from '@mui/material';
import type { Channel } from '@tunarr/types';

type Props = {
  selectedChannelIds: string[];
  allChannels: Channel[];
  onClearSelection: () => void;
  onAssignFillers: () => void;
};

export function BulkActionsToolbar({
  selectedChannelIds,
  onClearSelection,
  onAssignFillers,
}: Props) {
  return (
    <Paper
      elevation={8}
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 1100,
        px: 3,
        py: 1.5,
        mt: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
      }}
    >
      <Typography variant="body1" fontWeight="medium">
        <Plural
          value={selectedChannelIds.length}
          one="# channel selected"
          other="# channels selected"
        />
      </Typography>
      <Stack direction="row" spacing={1}>
        <Button
          variant="contained"
          startIcon={<PlaylistAdd />}
          onClick={onAssignFillers}
        >
          <Trans>Assign Fillers</Trans>
        </Button>
        <Button variant="outlined" onClick={onClearSelection}>
          <Trans>Clear Selection</Trans>
        </Button>
      </Stack>
    </Paper>
  );
}
