import { Trans } from '@lingui/react/macro';
import { CopyAll, Refresh, Search } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  Divider,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import {
  useQuery,
  useQueryClient,
  useSuspenseQuery,
} from '@tanstack/react-query';
import dayjs from 'dayjs';
import { isUndefined } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';
import {
  getApiSystemDebugEnvOptions,
  getApiSystemDebugNvidiaOptions,
  getApiSystemDebugVaapiOptions,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useCopyToClipboardSync } from '../../hooks/useCopyToClipboard.ts';
import { useServerEvents } from '../../hooks/useServerEvents.ts';

export const SystemDebugPage = () => {
  const [checkVaapiEnabled, setCheckVaapiEnabled] = useState(false);
  const [checkNvidiaEnabled, setCheckNvidiaEnabled] = useState(false);
  const queryClient = useQueryClient();
  const copyToClipboard = useCopyToClipboardSync();

  const envData = useSuspenseQuery({
    ...getApiSystemDebugEnvOptions(),
    staleTime: +dayjs.duration(1, 'hour'),
  });

  const ctx = useServerEvents();

  useEffect(() => {
    const key = ctx.addListener((ev) => {
      if (ev.type === 'lifecycle') {
        queryClient
          .invalidateQueries({
            exact: true,
            queryKey: ['system', 'debug', 'env'],
          })
          .catch(console.error);
      }
    });
    return () => ctx.removeListener(key);
  }, [ctx, queryClient]);

  const {
    isLoading: isLoadingVaapiCapabilities,
    data: vappiCapabilitiesResult,
  } = useQuery({
    ...getApiSystemDebugVaapiOptions(),
    enabled: checkVaapiEnabled,
  });

  const {
    isLoading: isLoadingNvidiaCapabilities,
    data: nvidiaCapabilitiesResult,
  } = useQuery({
    ...getApiSystemDebugNvidiaOptions(),
    enabled: checkNvidiaEnabled,
  });

  const handleCheckNvidia = useCallback(() => {
    if (!checkNvidiaEnabled) {
      setCheckNvidiaEnabled(true);
    } else {
      queryClient
        .invalidateQueries({
          exact: true,
          queryKey: ['system', 'debug', 'nvidia'],
        })
        .catch(console.error);
    }
  }, [checkNvidiaEnabled, queryClient]);

  const handleCheckVaapi = useCallback(() => {
    if (!checkVaapiEnabled) {
      setCheckVaapiEnabled(true);
    } else {
      queryClient
        .invalidateQueries({
          exact: true,
          queryKey: ['system', 'debug', 'vaapi'],
        })
        .catch(console.error);
    }
  }, [checkVaapiEnabled, queryClient]);

  return (
    <Stack spacing={2}>
      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography sx={{ mb: 1, flexGrow: 1 }} variant="h5">
            <Trans>Nvidia Capabilities</Trans>
          </Typography>
          {nvidiaCapabilitiesResult && (
            <Button
              onClick={() => copyToClipboard(nvidiaCapabilitiesResult)}
              startIcon={<CopyAll />}
            >
              <Trans>Copy</Trans>
            </Button>
          )}
          <Button
            startIcon={checkNvidiaEnabled ? <Refresh /> : <Search />}
            onClick={() => handleCheckNvidia()}
            variant="contained"
          >
            <Trans>Check</Trans>
          </Button>
        </Box>
        {isLoadingNvidiaCapabilities && <LinearProgress />}
        <Collapse in={!isUndefined(nvidiaCapabilitiesResult)}>
          <Box sx={{ maxHeight: 500, overflowY: 'scroll' }}>
            <pre>{nvidiaCapabilitiesResult}</pre>
          </Box>
        </Collapse>
      </Stack>
      <Divider />

      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography sx={{ mb: 1, flexGrow: 1 }} variant="h5">
            <Trans>VAAPI Capabilities</Trans>
          </Typography>
          {vappiCapabilitiesResult && (
            <Button
              onClick={() => copyToClipboard(vappiCapabilitiesResult)}
              startIcon={<CopyAll />}
            >
              <Trans>Copy</Trans>
            </Button>
          )}
          <Button
            startIcon={checkVaapiEnabled ? <Refresh /> : <Search />}
            onClick={() => handleCheckVaapi()}
            variant="contained"
          >
            <Trans>Check</Trans>
          </Button>
        </Box>
        {isLoadingVaapiCapabilities && <LinearProgress />}
        <Collapse in={!isUndefined(vappiCapabilitiesResult)}>
          <Box sx={{ maxHeight: 500, overflowY: 'scroll' }}>
            <pre>{vappiCapabilitiesResult}</pre>
          </Box>
        </Collapse>
      </Stack>
      <Divider />

      <Stack spacing={2}>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <Typography sx={{ mb: 1, flexGrow: 1 }} variant="h5">
            <Trans>System Environment</Trans>
          </Typography>
          <Button
            onClick={() =>
              copyToClipboard(JSON.stringify(envData.data, undefined, 4))
            }
            startIcon={<CopyAll />}
          >
            <Trans>Copy</Trans>
          </Button>
        </Box>
        <Box sx={{ maxHeight: 500, overflowY: 'scroll' }}>
          <pre>{JSON.stringify(envData.data, undefined, 4)}</pre>
        </Box>
      </Stack>
    </Stack>
  );
};
