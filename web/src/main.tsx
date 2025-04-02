import { routeTree } from '@/routeTree.gen';
import { createRouter } from '@tanstack/react-router';
import dayjs from 'dayjs';
import 'dayjs/locale/en-gb';
import localeData from 'dayjs/plugin/localeData';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import React from 'react';
import ReactDOM from 'react-dom/client';
import { Tunarr } from './Tunarr.tsx';
import { getApiClient } from './context/TunarrApiContext.tsx';
import './helpers/dayjs.ts';
import './index.css';
import { queryClient } from './queryClient.ts';

// Create a new router instance
export const router = createRouter({
  routeTree,
  context: { queryClient, tunarrApiClientProvider: getApiClient },
});

// Register the router instance for type safety
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

dayjs.extend(localizedFormat);
dayjs.extend(localeData);
dayjs.locale('en-gb');

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Tunarr />
  </React.StrictMode>,
);
