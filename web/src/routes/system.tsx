import { createFileRoute, useChildMatches } from '@tanstack/react-router';
import { head } from 'lodash-es';
import { SystemLayout } from '../pages/system/SystemLayout.tsx';

export const Route = createFileRoute('/system')({
  component: Wrapper,
});

function Wrapper() {
  const firstChild = useChildMatches();
  return (
    <SystemLayout
      currentTab={head(firstChild)?.fullPath.replace(/^\/system/, '')}
    />
  );
}
