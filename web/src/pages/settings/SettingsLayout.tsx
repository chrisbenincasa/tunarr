import { Box, LinearProgress, Paper, Tabs, Typography } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';
import { RouterTabLink } from '../../components/base/RouterTabLink.tsx';

type Props = {
  currentTab?: string;
};

export function SettingsLayout({ currentTab = '/general' }: Props) {
  return (
    <Box>
      <Typography variant="h3" mb={2}>
        Settings
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
            <RouterTabLink
              label="General"
              value="/general"
              to="/settings/general"
            />
            <RouterTabLink label="XMLTV" value="/xmltv" to="/settings/xmltv" />
            <RouterTabLink
              label="FFMPEG"
              value="/ffmpeg"
              to="/settings/ffmpeg"
            />
            <RouterTabLink
              label="Sources"
              value="/sources"
              to="/settings/sources"
            />
            <RouterTabLink label="HDHR" value="/hdhr" to="/settings/hdhr" />
          </Tabs>
        </Box>

        <Box sx={{ py: [1, 2] }}>
          <Suspense fallback={<LinearProgress />}>
            <Outlet />
          </Suspense>
        </Box>
      </Paper>
    </Box>
  );
}
