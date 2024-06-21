import { ErrorPage } from '@/pages/ErrorPage';
import SettingsLayout from '@/pages/settings/SettingsLayout';
import { useQueryErrorResetBoundary } from '@tanstack/react-query';
import {
  ErrorComponentProps,
  createFileRoute,
  useRouter,
} from '@tanstack/react-router';
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
  component: SettingsLayout,
  errorComponent: WrappedError,
});
