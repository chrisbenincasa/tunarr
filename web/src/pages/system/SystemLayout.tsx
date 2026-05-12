import { Trans, useLingui } from '@lingui/react/macro';
import { Box, LinearProgress, Paper, Tabs, Typography } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';
import { RouterTabLink } from '../../components/base/RouterTabLink.tsx';

type Props = {
  currentTab?: string;
};

export const SystemLayout = ({ currentTab }: Props) => {
  const { t } = useLingui();
  currentTab ??= '/';
  return (
    <Box>
      <Typography variant="h3" mb={2}>
        <Trans>System</Trans>
      </Typography>
      <Paper sx={{ p: [1, 2] }}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tabs
            value={currentTab}
            variant="scrollable"
            allowScrollButtonsMobile
            sx={{
              '& .MuiTabs-scrollButtons.Mui-disabled': {
                opacity: 0.2,
              },
            }}
          >
            <RouterTabLink label={t`Status`} value="/" to="/system" />
            <RouterTabLink label={t`Debug`} value="/debug" to="/system/debug" />
            <RouterTabLink label={t`Logs`} value="/logs" to="/system/logs" />
            <RouterTabLink label={t`Tasks`} value="/tasks" to="/system/tasks" />
            <RouterTabLink
              label={t`Troubleshoot`}
              value="/troubleshoot"
              to="/system/troubleshoot"
            />
          </Tabs>
        </Box>
        <Box sx={{ py: [1, 3] }}>
          <Suspense fallback={<LinearProgress />}>
            <Outlet />
          </Suspense>
        </Box>
      </Paper>
    </Box>
  );
};
