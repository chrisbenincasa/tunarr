import { Close, Refresh } from '@mui/icons-material';
import { Button, Stack } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { trimStart } from 'lodash-es';
import { useSnackbar } from 'notistack';
import type { StrictOmit } from 'ts-essentials';
import { getApiVersionOptions } from '../generated/@tanstack/react-query.gen.ts';

export const useVersion = (
  extraOpts: StrictOmit<
    ReturnType<typeof getApiVersionOptions>,
    'queryKey' | 'queryFn'
  > = {},
) => {
  const snackbar = useSnackbar();
  const query = useQuery({
    ...getApiVersionOptions(),
    ...extraOpts,
    staleTime: extraOpts.staleTime ?? 30 * 1000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const versionMismatch =
    !query.isLoading &&
    trimStart(query.data?.tunarr, 'v') !== trimStart(__TUNARR_VERSION__, 'v');

  if (versionMismatch) {
    snackbar.enqueueSnackbar({
      key: 'version_mismatch',
      preventDuplicate: true,
      message: (
        <span>
          <strong>Version Mismatch!</strong>
          <br />
          The loaded version of the Tunarr UI does not match the server. Reload
          the browser to get the latest. If this message persists, clear your
          browser cache and reload.
          <br />
          Web version = {trimStart(__TUNARR_VERSION__, 'v')}, Server version ={' '}
          {trimStart(query.data?.tunarr, 'v')}
        </span>
      ),
      variant: 'warning',
      persist: true,
      anchorOrigin: {
        horizontal: 'center',
        vertical: 'top',
      },
      action: () => {
        return (
          <Stack direction="row">
            <Button
              startIcon={<Refresh />}
              onClick={() => window.location.reload()}
              color="inherit"
            >
              Refresh
            </Button>
            <Button
              startIcon={<Close />}
              onClick={() => snackbar.closeSnackbar('version_mismatch')}
              color="inherit"
            >
              Dismiss
            </Button>
          </Stack>
        );
      },
    });
  }

  return query;
};
