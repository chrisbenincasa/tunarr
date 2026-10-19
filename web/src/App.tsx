import { Trans } from '@lingui/react/macro';
import { Alert } from '@mui/material';
import CssBaseline from '@mui/material/CssBaseline';
import { Outlet } from '@tanstack/react-router';
import React from 'react';
import './App.css';
import { RouterButtonLink } from './components/base/RouterButtonLink.tsx';
import { RouterLink } from './components/base/RouterLink.tsx';
import { NewMediaSourceLibrariesPrompt } from './components/settings/media_source/NewMediaSourceLibrariesPrompt.tsx';
import { AppShellContainer } from './components/shell/AppShellContainer.tsx';
import { useServerEventsSnackbar } from './hooks/useServerEvents.ts';
import { useVersion } from './hooks/useVersion.tsx';
export function Root({ children }: { children?: React.ReactNode }) {
  useServerEventsSnackbar();

  const { data: version } = useVersion();

  return (
    <>
      <CssBaseline />
      <AppShellContainer>
        {version?.ffmpeg === 'unknown' ? (
          <Alert
            variant="filled"
            severity="error"
            sx={{ mb: 2, display: 'flex', flexGrow: 1, width: '100%' }}
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
            <Trans>
              FFmpeg not found. For all features to work, we recommend
              installing FFmpeg 7.1+ or update your FFmpeg executable path in
              settings.
            </Trans>
          </Alert>
        ) : null}
        {children ?? <Outlet />}
        <NewMediaSourceLibrariesPrompt />
      </AppShellContainer>
    </>
  );
}

export default function App() {
  return (
    <>
      <RouterLink to={'/channels'}>
        <Trans>Channels</Trans>
      </RouterLink>
    </>
  );
}
