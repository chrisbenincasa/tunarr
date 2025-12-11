import { Alert, Box, Toolbar, useTheme } from '@mui/material';
import Container from '@mui/material/Container';
import CssBaseline from '@mui/material/CssBaseline';
import useMediaQuery from '@mui/material/useMediaQuery';
import { Outlet } from '@tanstack/react-router';
import React from 'react';
import './App.css';
import { RouterButtonLink } from './components/base/RouterButtonLink.tsx';
import { RouterLink } from './components/base/RouterLink.tsx';
import { BottomNavBar } from './components/BottomNavBar.tsx';
import { Drawer } from './components/Drawer.tsx';
import { TopBar } from './components/TopBar.tsx';
import { useServerEventsSnackbar } from './hooks/useServerEvents.ts';
import { useIsDarkMode } from './hooks/useTunarrTheme.ts';
import { useVersion } from './hooks/useVersion.tsx';
import { strings } from './strings.ts';

export function Root({ children }: { children?: React.ReactNode }) {
  useServerEventsSnackbar();

  const { data: version } = useVersion();

  const theme = useTheme();
  const darkMode = useIsDarkMode();

  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  return (
    <Box
      sx={{
        display: 'flex',
        backgroundColor: darkMode ? 'transparent' : '#f5fafc',
        minHeight: '100vh',
      }}
    >
      <CssBaseline />

      <TopBar />
      {!smallViewport ? <Drawer /> : <BottomNavBar />}
      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // height: '100vh', // Uncommenting this breaks any use of scrollTo()
          // overflow: 'auto', // Commenting out to support position: sticky
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
            maxWidth: 'calc(100vw - 240px)',
            flexGrow: 1,
          }}
        >
          {version?.ffmpeg === 'unknown' ? (
            <Alert
              variant="filled"
              severity="error"
              sx={{ my: 2, display: 'flex', flexGrow: 1, width: '100%' }}
              action={
                <RouterButtonLink
                  to={'/settings/ffmpeg'}
                  size="small"
                  sx={{
                    color: 'inherit',
                  }}
                >
                  Fix
                </RouterButtonLink>
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
      <RouterLink to={'/channels'}>Channels</RouterLink>
    </>
  );
}
