import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './helpers/dayjs.ts';
import './index.css';
import { queryCache } from './queryClient.ts';
import { router } from './router.tsx';
import { TunarrApiProvider } from './components/TunarrApiContext.tsx';
import { SnackbarProvider } from 'notistack';
import { ServerEventsProvider } from './components/server_events/ServerEventsProvider.tsx';

const queryClient = new QueryClient({ queryCache });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TunarrApiProvider queryClient={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DndProvider backend={HTML5Backend}>
          <ServerEventsProvider>
            <QueryClientProvider client={queryClient}>
              <SnackbarProvider maxSnack={2} autoHideDuration={5000}>
                <RouterProvider router={router} />
              </SnackbarProvider>
            </QueryClientProvider>
          </ServerEventsProvider>
        </DndProvider>
      </LocalizationProvider>
    </TunarrApiProvider>
  </React.StrictMode>,
);
