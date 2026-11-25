import { useLingui } from '@lingui/react/macro';
import type { ScheduleEditOutcome } from '@tunarr/types';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

// Tells the user when a slot save on a rebuilding channel could not keep each
// show's place. A lineup with no slot schedule before the save had no places
// to keep, so it stays quiet.
export const useScheduleEditNotice = () => {
  const { t } = useLingui();
  const snackbar = useSnackbar();

  return useCallback(
    (outcome: ScheduleEditOutcome | undefined) => {
      if (!outcome || outcome.placesCarried) {
        return;
      }

      switch (outcome.reason) {
        case 'no_seed':
          snackbar.enqueueSnackbar(
            t`Shows start from the beginning. This schedule was saved by an older version of Tunarr, so their places couldn't be recovered.`,
            { variant: 'warning' },
          );
          return;
        case 'replay_mismatch':
          snackbar.enqueueSnackbar(
            t`Shows start from the beginning. The saved lineup no longer matches its schedule, so their places couldn't be recovered.`,
            { variant: 'warning' },
          );
          return;
        case 'not_started':
          snackbar.enqueueSnackbar(
            t`Shows start from the beginning, because nothing has aired on this channel yet.`,
            { variant: 'info' },
          );
          return;
        case 'no_schedule':
          return;
      }
    },
    [snackbar, t],
  );
};
