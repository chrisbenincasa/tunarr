import { Box } from '@mui/material';
import {
  createMemoryHistory,
  createRootRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router';
import { type ReactNode, useState } from 'react';
import { PageHeader } from '../../PageHeader.tsx';

// Story-only components. Nothing in the app imports this file.

export const StoryRouter = ({
  path,
  children,
}: {
  path: string;
  children: ReactNode;
}) => {
  const [router] = useState(() =>
    createRouter({
      routeTree: createRootRoute({ component: () => children }),
      history: createMemoryHistory({ initialEntries: [path] }),
    }),
  );
  return <RouterProvider router={router} />;
};

export const PlaceholderPage = ({ title }: { title: string }) => (
  <>
    <PageHeader title={title} subtitle="5 lists · 1,204 items" />
    <Box
      sx={{
        height: 480,
        border: 1,
        borderStyle: 'dashed',
        borderColor: 'tokens.borderStrong',
        borderRadius: 3,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'text.secondary',
      }}
    >
      [{title} page content]
    </Box>
  </>
);
