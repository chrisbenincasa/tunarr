import { Trans } from '@lingui/react/macro';
import { Box, LinearProgress, Paper, Typography } from '@mui/material';
import { Outlet } from '@tanstack/react-router';
import { Suspense } from 'react';

export const SystemLayout = () => {
  return (
    <Box>
      <Typography variant="h3" mb={2}>
        <Trans>System</Trans>
      </Typography>
      <Paper sx={{ p: [1, 2] }}>
        <Box sx={{ py: [1, 3] }}>
          <Suspense fallback={<LinearProgress />}>
            <Outlet />
          </Suspense>
        </Box>
      </Paper>
    </Box>
  );
};
