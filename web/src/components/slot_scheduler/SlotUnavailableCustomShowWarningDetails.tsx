import type { UnavailableCustomShowWarning } from '@/model/CommonSlotModels.ts';
import { Trans } from '@lingui/react/macro';
import { Alert } from '@mui/material';

type Props = {
  warning: UnavailableCustomShowWarning;
};

export const SlotUnavailableCustomShowWarningDetails = ({ warning }: Props) => {
  return (
    <Alert severity="error" sx={{ mb: 1 }}>
      {warning.reason === 'empty' ? (
        <Trans>
          This slot's playlist has no programs, so the slot cannot be scheduled.
          Add programs to the playlist, choose another playlist, or remove the
          slot.
        </Trans>
      ) : (
        <Trans>
          This slot's playlist was deleted, so the slot cannot be scheduled.
          Choose another playlist or remove the slot.
        </Trans>
      )}
    </Alert>
  );
};
