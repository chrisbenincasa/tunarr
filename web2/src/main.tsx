import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { DndProvider } from 'react-dnd';
import { HTML5Backend } from 'react-dnd-html5-backend';
import ReactDOM from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import './helpers/dayjs.ts';
import './index.css';
import { queryCache } from './queryClient.ts';
import { router } from './router';

const queryClient = new QueryClient({ queryCache });

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DndProvider backend={HTML5Backend}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </DndProvider>
  </React.StrictMode>,
);
