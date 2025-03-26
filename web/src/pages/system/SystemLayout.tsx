import { Box, LinearProgress, Tab, Tabs, Typography } from '@mui/material';
import { Link, Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';

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
      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
        <Tabs value={currentTab} variant="scrollable" allowScrollButtonsMobile>
          <Tab label="Status" value="/" to="/system" component={Link} />
          <Tab
            label="Debug"
            value="/debug"
            to="/system/debug"
            component={Link}
          />
          <Tab label="Logs" value="/logs" to="/system/logs" component={Link} />
        </Tabs>
        <Suspense fallback={<LinearProgress />}>
          <Outlet />
        </Suspense>
      </Box>
    </Box>
  );
};
