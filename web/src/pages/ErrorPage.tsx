import { useBrowserInfo } from '@/hooks/useBrowserInfo';
import GitHub from '@mui/icons-material/GitHub';
import Refresh from '@mui/icons-material/Refresh';
import { Box, Button, Collapse, Stack, Typography } from '@mui/material';
import { isError } from 'lodash-es';
import { useMemo } from 'react';
import errorImage from '../assets/error_this_is_fine.png';
import { RotatingLoopIcon } from '../components/base/LoadingIcon';
import { useVersion } from '../hooks/useVersion.tsx';

type Props = {
  error: unknown;
  resetRoute: () => void;
};

export function ErrorPage({ error }: Props) {
  const browser = useBrowserInfo();
  const { data: version, isLoading: versionLoading } = useVersion();
  const stack = (isError(error) ? error.stack : '') ?? '';

  const bugReportLink = useMemo(() => {
    const url = new URL(`https://github.com/chrisbenincasa/tunarr/issues/new`);
    let browserString = browser.getBrowserName();
    if (browser.getBrowserVersion()) {
      browserString += ` (${browser.getBrowserVersion()})`;
    }
    let osString = browser.getOSName();
    if (browser.getOSVersion()) {
      osString += ` (${browser.getOSVersion()})`;
    }
    url.searchParams.append('template', 'bug_report.yaml');
    url.searchParams.append('browser', browserString);
    url.searchParams.append('os', osString);
    url.searchParams.append('version', version?.tunarr ?? '');
    url.searchParams.append('logs', stack);
    return url;
  }, [browser, stack, version?.tunarr]);

  const handleRefresh = () => {
    location.reload();
  };

  return (
    <Box sx={{ width: '100%' }}>
      <Box
        sx={{ margin: 'auto', display: 'block', pl: 3 }}
        component="img"
        src={errorImage}
      />
      <div style={{ textAlign: 'center' }}>
        <Typography variant="h2" sx={{ pb: 1 }}>
          Oops!
        </Typography>
        <Typography>Looks like something went wrong.</Typography>
      </div>
      <Stack direction="row" sx={{ justifyContent: 'center' }} gap={2}>
        <Button
          onClick={handleRefresh}
          variant="contained"
          startIcon={<Refresh />}
        >
          Refresh Page
        </Button>
        <Button
          component="a"
          href={bugReportLink.toString()}
          target="_blank"
          variant="contained"
          startIcon={versionLoading ? <RotatingLoopIcon /> : <GitHub />}
          disabled={versionLoading}
        >
          {versionLoading
            ? 'Generating Bug Report Link...'
            : 'File a Bug Report'}
        </Button>
      </Stack>
      {stack && (
        <Collapse in={true}>
          <Box
            component="pre"
            sx={{ width: '100%', overflowX: 'scroll', p: 1 }}
          >
            {stack}
          </Box>
        </Collapse>
      )}
    </Box>
  );
}
