import { Plural, Trans } from '@lingui/react/macro';
import { Alert } from '@mui/material';
import { BulkAssignFillersMaxChannels } from '@tunarr/types/api';

type Props = {
  selectedCount: number;
};

export function BulkAssignChannelLimitAlert({ selectedCount }: Props) {
  const excess = selectedCount - BulkAssignFillersMaxChannels;
  const max = BulkAssignFillersMaxChannels;
  return (
    <Alert severity="warning" sx={{ mt: 1 }}>
      <Trans>
        Filler lists can be assigned to at most {max} channels at a time.
        Deselect <Plural value={excess} one="# channel" other="# channels" /> to
        continue.
      </Trans>
    </Alert>
  );
}
