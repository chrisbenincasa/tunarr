import { Refresh } from '@mui/icons-material';
import { Button } from '@mui/material';
import type { UseQueryOptions } from '@tanstack/react-query';
import type { VersionApiResponse } from '@tunarr/types/api';
import { useSnackbar } from 'notistack';
import { useApiQuery } from './useApiQuery.ts';

export const useVersion = (
  extraOpts: Omit<
    UseQueryOptions<VersionApiResponse>,
    'queryKey' | 'queryFn'
  > = {},
) => {
  const snackbar = useSnackbar();
  const query = useApiQuery({
    queryKey: ['version'],
    queryFn: (apiClient) => apiClient.getServerVersions(),
    ...extraOpts,
    staleTime: extraOpts.staleTime ?? 30 * 1000,
    refetchOnReconnect: true,
    refetchOnWindowFocus: true,
  });

  const versionMismatch =
    !query.isLoading && query.data?.tunarr !== __TUNARR_VERSION__;

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
          <>
            <Button
              startIcon={<Refresh />}
              onClick={() => window.location.reload()}
              color="inherit"
            >
              Refresh
            </Button>
          </>
        );
      },
    });
  }

  return query;
};
