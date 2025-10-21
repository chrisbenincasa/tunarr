import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/library/smart_collections/$id')({
  component: RouteComponent,
});

function RouteComponent() {
  return <div>Hello "/smart_collections/$id"!</div>;
}
