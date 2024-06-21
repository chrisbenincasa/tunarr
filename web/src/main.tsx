import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ReactDOM from 'react-dom/client';
// import { RouterProvider } from '@tanstack/react-router';
import './helpers/dayjs.ts';
import './index.css';
import { queryClient } from './queryClient.ts';
// import { router } from './router.tsx';
import { routeTree } from '@/routeTree.gen';
import { RouterProvider, createRouter } from '@tanstack/react-router';
import {
  TunarrApiProvider,
  getApiClient,
} from './components/TunarrApiContext.tsx';
import { SnackbarProvider } from 'notistack';
import { ServerEventsProvider } from './components/server_events/ServerEventsProvider.tsx';

// Import the generated route tree

// Create a new router instance
const router = createRouter({
  routeTree,
  context: { queryClient, tunarrApiClientProvider: getApiClient },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TunarrApiProvider queryClient={queryClient}>
      <LocalizationProvider dateAdapter={AdapterDayjs}>
        <DndProvider backend={HTML5Backend}>
          <ServerEventsProvider>
            <QueryClientProvider client={queryClient}>
              <SnackbarProvider maxSnack={2} autoHideDuration={5000}>
                <RouterProvider basepath="/web" router={router} />
              </SnackbarProvider>
            </QueryClientProvider>
          </ServerEventsProvider>
        </DndProvider>
      </LocalizationProvider>
    </TunarrApiProvider>
  </React.StrictMode>,
);
