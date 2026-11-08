import { Trans, useLingui } from '@lingui/react/macro';
import { Button } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';
import { useSnackbar } from 'notistack';
import { useEffect } from 'react';
import { shouldNotifyQueryError } from '../helpers/queryErrorSnackbar.ts';

const SnackbarKey = 'query-error';

/**
 * Shows one snackbar linking to System > Logs when a query fails with nothing
 * on screen. Mount it inside the router, because the snackbar provider sits
 * outside it and the action needs a router-bound `navigate`.
 */
export function useQueryErrorSnackbar() {
  const queryClient = useQueryClient();
  const { enqueueSnackbar, closeSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { t } = useLingui();

  useEffect(() => {
    return queryClient.getQueryCache().subscribe((event) => {
      if (!shouldNotifyQueryError(event)) {
        return;
      }

      enqueueSnackbar(
        t`Something went wrong loading data. Check the logs for details.`,
        {
          key: SnackbarKey,
          preventDuplicate: true,
          variant: 'error',
          action: (key) => (
            <Button
              color="inherit"
              size="small"
              onClick={() => {
                closeSnackbar(key);
                void navigate({ to: '/system/logs' });
              }}
            >
              <Trans>View logs</Trans>
            </Button>
          ),
        },
      );
    });
  }, [queryClient, enqueueSnackbar, closeSnackbar, navigate, t]);
}
