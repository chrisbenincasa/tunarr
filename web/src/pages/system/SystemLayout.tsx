import { Box, LinearProgress, Paper, Tabs, Typography } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';
import { RouterTabLink } from '../../components/base/RouterTabLink.tsx';

type Props = {
  currentTab?: string;
};

export const SystemLayout = ({ currentTab }: Props) => {
  currentTab ??= '/';
  return (
    <Box>
      <Typography variant="h3" mb={2}>
        System
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
            <RouterTabLink label="Status" value="/" to="/system" />
            <RouterTabLink label="Debug" value="/debug" to="/system/debug" />
            <RouterTabLink label="Logs" value="/logs" to="/system/logs" />
            <RouterTabLink label="Tasks" value="/tasks" to="/system/tasks" />
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
