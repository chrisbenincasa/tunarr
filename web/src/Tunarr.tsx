import { DayjsProvider } from '@/providers/DayjsProvider.tsx';
import useStore from '@/store/index.ts';
import { ThemeProvider } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from '@tanstack/react-router';
import { SnackbarProvider } from 'notistack';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import { ServerEventsProvider } from './components/server_events/ServerEventsProvider.tsx';
import { TunarrApiProvider } from './context/TunarrApiContext.tsx';
import { queryClient } from './queryClient.ts';
import { router } from './router.ts';
import { Theme } from './theme.ts';

export const Tunarr = () => {
  const locale = useStore((store) => store.settings.ui.i18n.locale);

  return (
    <TunarrApiProvider queryClient={queryClient}>
      <DayjsProvider>
        <LocalizationProvider dateAdapter={AdapterDayjs} adapterLocale={locale}>
          <DndProvider backend={HTML5Backend}>
            <ServerEventsProvider>
              <QueryClientProvider client={queryClient}>
                <SnackbarProvider maxSnack={2} autoHideDuration={5000}>
                  <ThemeProvider theme={Theme} noSsr>
                    <RouterProvider basepath="/web" router={router} />
                  </ThemeProvider>
                </SnackbarProvider>
              </QueryClientProvider>
            </ServerEventsProvider>
          </DndProvider>
        </LocalizationProvider>
      </DayjsProvider>
    </TunarrApiProvider>
  );
};
