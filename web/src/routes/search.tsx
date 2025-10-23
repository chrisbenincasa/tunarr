import { createFileRoute } from '@tanstack/react-router';
import { LibrarySearch } from '../components/library/LibrarySearch.tsx';
import { Route as RootRoute } from './__root.tsx';

export const Route = createFileRoute('/search')({
  component: RouteComponent,
});

function RouteComponent() {
  const searchParams = RootRoute.useSearch();
  return (
    <LibrarySearch
      disableProgramSelection
      initialSearchQuery={searchParams?.query}
    />
  );
}
