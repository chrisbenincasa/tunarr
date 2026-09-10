import {
  deleteApiTrashMutation,
  getApiTrashStatusOptions,
  getApiTrashStatusQueryKey,
  postApiTrashCancelMutation,
} from '@/generated/@tanstack/react-query.gen.ts';
import {
  invalidateQueryPrefix,
  invalidateTaggedQueries,
} from '@/helpers/queryUtil.ts';
import { useServerEvents } from '@/hooks/useServerEvents.ts';
import { useLingui } from '@lingui/react/macro';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { EmptyTrashStatus } from '@tunarr/types/api';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useRef } from 'react';

const PollIntervalMs = 1000;

const isDraining = (status: EmptyTrashStatus | undefined) =>
  status?.state === 'running' || status?.state === 'cancelling';

/**
 * Drives the asynchronous empty-trash job: kicks it off, polls its progress
 * while it runs, and refreshes everything the drain touches once it finishes.
 */
export const useEmptyTrash = () => {
  const { t } = useLingui();
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  const { addListener, removeListener } = useServerEvents();

  const { data: status } = useQuery({
    ...getApiTrashStatusOptions(),
    // Stop polling once the server is idle; the mutation and the SSE event
    // restart it.
    refetchInterval: (query) =>
      query.state.data?.state === 'idle' ? false : PollIntervalMs,
    staleTime: 0,
  });

  const draining = isDraining(status);

  const invalidateAfterDrain = useCallback(() => {
    queryClient
      .invalidateQueries({
        predicate: invalidateQueryPrefix(['programs', 'search']),
      })
      .catch(console.error);
    // Lineups genuinely change during a drain, so channels and the guide are
    // stale too - not just the trash listing.
    queryClient
      .invalidateQueries({
        predicate: invalidateTaggedQueries(['Trash', 'Channels', 'Guide']),
      })
      .catch(console.error);
  }, [queryClient]);

  // Fire on the running -> idle transition rather than on mutation success:
  // the mutation returns immediately with a 202.
  const wasDraining = useRef(false);
  useEffect(() => {
    if (wasDraining.current && !draining) {
      invalidateAfterDrain();
    }
    wasDraining.current = draining;
  }, [draining, invalidateAfterDrain]);

  // Belt to the polling's braces: the SSE event lands immediately and works
  // even when the user has navigated away from the trash page.
  useEffect(() => {
    const key = addListener((ev) => {
      if (ev.type !== 'empty_trash') {
        return;
      }

      if (ev.detail.status === 'completed') {
        snackbar.enqueueSnackbar({
          message: t`Emptied trash. Removed ${ev.detail.deleted} item(s).`,
          variant: 'success',
        });
      } else if (ev.detail.status === 'failed') {
        snackbar.enqueueSnackbar({
          message: t`Emptying the trash failed. Check the server logs for details.`,
          variant: 'error',
        });
      } else {
        return;
      }

      queryClient
        .invalidateQueries({ queryKey: getApiTrashStatusQueryKey() })
        .catch(console.error);
      invalidateAfterDrain();
    });

    return () => removeListener(key);
  }, [
    addListener,
    removeListener,
    snackbar,
    t,
    queryClient,
    invalidateAfterDrain,
  ]);

  const refetchStatus = useCallback(() => {
    queryClient
      .invalidateQueries({ queryKey: getApiTrashStatusQueryKey() })
      .catch(console.error);
  }, [queryClient]);

  const emptyTrashMut = useMutation({
    ...deleteApiTrashMutation(),
    onSuccess: () => {
      snackbar.enqueueSnackbar({
        message: t`Emptying trash in the background. You can keep using Tunarr.`,
        variant: 'info',
      });
      refetchStatus();
    },
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message: t`Encountered an error when emptying trash. Check console logs for details.`,
      });
    },
  });

  const cancelMut = useMutation({
    ...postApiTrashCancelMutation(),
    onSuccess: refetchStatus,
    onError: (err) => {
      console.error(err);
      snackbar.enqueueSnackbar({
        variant: 'error',
        message: t`Could not cancel emptying the trash.`,
      });
    },
  });

  return {
    status,
    isDraining: draining,
    emptyTrash: () => emptyTrashMut.mutate({}),
    isStarting: emptyTrashMut.isPending,
    cancel: () => cancelMut.mutate({}),
    isCancelling: cancelMut.isPending || status?.state === 'cancelling',
  };
};
