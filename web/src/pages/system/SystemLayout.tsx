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
            <Tab label="Status" value="/" to="/system" component={Link} />
            <Tab
              label="Debug"
              value="/debug"
              to="/system/debug"
              component={Link}
            />
            <Tab
              label="Logs"
              value="/logs"
              to="/system/logs"
              component={Link}
            />
          </Tabs>
          <Box sx={{ py: [1, 3] }}>
            <Suspense fallback={<LinearProgress />}>
              <Outlet />
            </Suspense>
          </Box>
        </Box>
      </Paper>
    </Box>
  );
};
