import { Stack } from '@mui/material';
import { createFileRoute } from '@tanstack/react-router';
import { LibraryProgramGrid } from '../components/library/LibraryProgramGrid.tsx';
import { SearchInput } from '../components/library/SearchInput.tsx';
import { Route as RootRoute } from './__root.tsx';

export const Route = createFileRoute('/search')({
  component: RouteComponent,
});

function RouteComponent() {
  const searchParams = RootRoute.useSearch();
  return (
    <Stack gap={2}>
      <SearchInput
        disableProgramSelection
        initialSearchQuery={searchParams?.query}
      />
      <LibraryProgramGrid />
    </Stack>
  );
}
