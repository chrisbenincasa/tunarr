import { ErrorPage } from '@/pages/ErrorPage';
import { SettingsLayout } from '@/pages/settings/SettingsLayout';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import type { ErrorComponentProps } from '@tanstack/react-router';
import {
  createFileRoute,
  useChildMatches,
  useRouter,
} from '@tanstack/react-router';
import { head } from 'lodash-es';
import { useCallback, useEffect } from 'react';

const WrappedError = ({ error, reset }: ErrorComponentProps) => {
  const router = useRouter();
  const queryErrorResetBoundary = useQueryErrorResetBoundary();

  useEffect(() => {
    queryErrorResetBoundary.reset();
  }, [queryErrorResetBoundary]);

  const resetRoute = useCallback(() => {
    reset();
    router.invalidate().catch(console.warn);
  }, [reset, router]);

  return <ErrorPage error={error} resetRoute={resetRoute} />;
};

export const Route = createFileRoute('/settings')({
  component: Wrapper,
  errorComponent: WrappedError,
});

function Wrapper() {
  const firstChild = useChildMatches();
  return (
    <SettingsLayout
      currentTab={
        '/' +
        head(firstChild)
          ?.fullPath.replace(/^\/settings/, '')
          .split('/')[1]
      }
    />
  );
}
