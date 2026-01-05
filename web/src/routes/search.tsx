import { Stack } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { LibraryProgramGrid } from '../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../components/search/SearchInput.tsx';
import { Route as RootRoute } from './__root.tsx';

export const Route = createFileRoute('/search')({
  component: RouteComponent,
});

function RouteComponent() {
  const rootLoaderData = RootRoute.useLoaderData();
  return (
    <Stack gap={2}>
      <SearchInput
        initialSearchFilter={rootLoaderData?.searchRequest.filter ?? undefined}
      />
      <LibraryProgramGrid />
    </Stack>
  );
}
