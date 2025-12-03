import {
  Box,
  LinearProgress,
  Paper,
  Tab,
  Tabs,
  Typography,
} from '@mui/material';
import { Link, Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';

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
            <Tab
              label="General"
              value="/general"
              to="/settings/general"
              component={Link}
            />
            <Tab
              label="XMLTV"
              value="/xmltv"
              to="/settings/xmltv"
              component={Link}
            />
            <Tab
              label="FFMPEG"
              value="/ffmpeg"
              to="/settings/ffmpeg"
              component={Link}
            />
            <Tab
              label="Sources"
              value="/sources"
              to="/settings/sources"
              component={Link}
            />
            <Tab
              label="HDHR"
              value="/hdhr"
              to="/settings/hdhr"
              component={Link}
            />
            <Tab
              label="Tasks"
              value="/tasks"
              to="/settings/tasks"
              component={Link}
            />
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
