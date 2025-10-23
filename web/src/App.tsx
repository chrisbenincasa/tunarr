import { Alert, Box, Button, Link, Toolbar, useTheme } from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet, Link as RouterLink } from '@tanstack/react-router';
import React from 'react';
import './App.css';
import { BottomNavBar } from './components/BottomNavBar.tsx';
import { Drawer } from './components/Drawer.tsx';
import { TopBar } from './components/TopBar.tsx';
import { useServerEventsSnackbar } from './hooks/useServerEvents.ts';
import { useVersion } from './hooks/useVersion.tsx';
import { strings } from './strings.ts';

export function Root({ children }: { children?: React.ReactNode }) {
  useServerEventsSnackbar();

  const { data: version } = useVersion();

  const theme = useTheme();

  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box sx={{ display: 'flex' }}>
      <CssBaseline />

      <TopBar />
      {!smallViewport ? <Drawer /> : <BottomNavBar />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // height: '100vh', // Uncommenting this breaks any use of scrollTo()
          // overflow: 'auto', // Commenting out to support position: sticky
          ml: [undefined, '60px'],
        }}
      >
        <Toolbar />
        <Container
          disableGutters
          maxWidth="xl"
          sx={{
            mt: 4,
            mb: ['56px', 4],
            px: [undefined, 5],
            pb: [4, undefined],
            maxWidth: 'calc(100vw - 25px)',
          }}
        >
          {version?.ffmpeg === 'unknown' ? (
            <Alert
              variant="filled"
              severity="error"
              sx={{ my: 2, display: 'flex', flexGrow: 1, width: '100%' }}
              action={
                <Button
                  to={'/settings/ffmpeg'}
                  component={RouterLink}
                  size="small"
                  sx={{
                    color: 'inherit',
                  }}
                >
                  Fix
                </Button>
              }
            >
              {strings.FFMPEG_MISSING}
            </Alert>
          ) : null}
          {children ?? <Outlet />}
        </Container>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <>
      <Link to={'/channels'} component={RouterLink}>
        Channels
      </Link>
    </>
  );
}
