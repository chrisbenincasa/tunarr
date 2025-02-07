import { CopyAll, Refresh, Search } from '@mui/icons-material';
import {
  Box,
  Button,
  Collapse,
  LinearProgress,
  Stack,
  Typography,
} from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { isUndefined } from 'lodash-es';
import { useCallback, useState } from 'react';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { useApiQuery } from '../../hooks/useApiQuery.ts';
import { useCopyToClipboardSync } from '../../hooks/useCopyToClipboard.ts';

export const SystemDebugPage = () => {
  const [checkVaapiEnabled, setCheckVaapiEnabled] = useState(false);
  const [checkNvidiaEnabled, setCheckNvidiaEnabled] = useState(false);
  const queryClient = useQueryClient();
  const copyToClipboard = useCopyToClipboardSync();

  const {
    isLoading: isLoadingVaapiCapabilities,
    data: vappiCapabilitiesResult,
  } = useApiQuery({
    queryKey: ['system', 'debug', 'vaapi'],
    queryFn: (apiClient) => apiClient.getVaapiDebugInfo(),
    enabled: checkVaapiEnabled,
  });

  const {
    isLoading: isLoadingNvidiaCapabilities,
    data: nvidiaCapabilitiesResult,
  } = useApiQuery({
    queryKey: ['system', 'debug', 'nvidia'],
    queryFn: (apiClient) => apiClient.getNvidiaDebugInfo(),
    enabled: checkNvidiaEnabled,
  });

  const handleCheckNvidia = useCallback(() => {
    if (!checkVaapiEnabled) {
      setCheckNvidiaEnabled(true);
    } else {
      queryClient
        .invalidateQueries({
          exact: true,
          queryKey: ['system', 'debug', 'nvidia'],
        })
        .catch(console.error);
    }
  }, [checkVaapiEnabled, queryClient]);

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
      <PaddedPaper>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography sx={{ mb: 1, flexGrow: 1 }} variant="h5">
              Nvidia Capabilities
            </Typography>
            {nvidiaCapabilitiesResult && (
              <Button
                onClick={() => copyToClipboard(nvidiaCapabilitiesResult)}
                startIcon={<CopyAll />}
              >
                Copy
              </Button>
            )}
            <Button
              startIcon={checkNvidiaEnabled ? <Refresh /> : <Search />}
              onClick={() => handleCheckNvidia()}
              variant="contained"
            >
              Check
            </Button>
          </Box>
          {isLoadingNvidiaCapabilities && <LinearProgress />}
          <Collapse in={!isUndefined(nvidiaCapabilitiesResult)}>
            <Box sx={{ maxHeight: 500, overflowY: 'scroll' }}>
              <pre>{nvidiaCapabilitiesResult}</pre>
            </Box>
          </Collapse>
        </Stack>
      </PaddedPaper>
      <PaddedPaper>
        <Stack spacing={2}>
          <Box sx={{ display: 'flex', gap: 2 }}>
            <Typography sx={{ mb: 1, flexGrow: 1 }} variant="h5">
              VAAPI Capabilities
            </Typography>
            {vappiCapabilitiesResult && (
              <Button
                onClick={() => copyToClipboard(vappiCapabilitiesResult)}
                startIcon={<CopyAll />}
              >
                Copy
              </Button>
            )}
            <Button
              startIcon={checkVaapiEnabled ? <Refresh /> : <Search />}
              onClick={() => handleCheckVaapi()}
              variant="contained"
            >
              Check
            </Button>
          </Box>
          {isLoadingVaapiCapabilities && <LinearProgress />}
          <Collapse in={!isUndefined(vappiCapabilitiesResult)}>
            <Box sx={{ maxHeight: 500, overflowY: 'scroll' }}>
              <pre>{vappiCapabilitiesResult}</pre>
            </Box>
          </Collapse>
        </Stack>
      </PaddedPaper>
    </Stack>
  );
};
