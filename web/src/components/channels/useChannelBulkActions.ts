import { deleteApiChannelsById } from '@/generated/sdk.gen.ts';
import { invalidateTaggedQueries } from '@/helpers/queryUtil.ts';
import { useCreateChannel } from '@/hooks/useCreateChannel.ts';
import { plural } from '@lingui/core/macro';
import { useLingui } from '@lingui/react/macro';
import { useQueryClient } from '@tanstack/react-query';
import type { Channel } from '@tunarr/types';
import { useSnackbar } from 'notistack';
import { useCallback } from 'react';

export type RunEachResult = { succeeded: number; failed: number };

// Runs `task` on each item in order, so the server sees one change at a time.
// A failure is counted and the rest still run.
export const runEach = async <T>(
  items: readonly T[],
  task: (item: T) => Promise<unknown>,
): Promise<RunEachResult> => {
  let failed = 0;
  for (const item of items) {
    try {
      await task(item);
    } catch (err) {
      console.error(err);
      failed++;
    }
  }
  return { succeeded: items.length - failed, failed };
};

export const useChannelBulkActions = () => {
  const { t } = useLingui();
  const snackbar = useSnackbar();
  const queryClient = useQueryClient();
  const createChannel = useCreateChannel();

  const report = useCallback(
    ({ succeeded, failed }: RunEachResult, done: string, broke: string) => {
      if (failed > 0) {
        snackbar.enqueueSnackbar(broke, { variant: 'error' });
      } else if (succeeded > 0) {
        snackbar.enqueueSnackbar(done, { variant: 'success' });
      }
    },
    [snackbar],
  );

  // Copies get the next free channel numbers, so they run one at a time.
  const duplicateChannels = useCallback(
    async (channels: Channel[]) => {
      const result = await runEach(channels, (channel) =>
        createChannel.mutateAsync({
          body: { type: 'copy', channelId: channel.id },
        }),
      );
      report(
        result,
        plural(result.succeeded, {
          one: 'Duplicated # channel',
          other: 'Duplicated # channels',
        }),
        t`${result.failed} of ${channels.length} channels failed to duplicate`,
      );
    },
    [createChannel, report, t],
  );

  const deleteChannels = useCallback(
    async (channels: Channel[]) => {
      const result = await runEach(channels, (channel) =>
        deleteApiChannelsById({
          path: { id: channel.id },
          throwOnError: true,
        }),
      );
      await queryClient.invalidateQueries({
        predicate: invalidateTaggedQueries('Channels'),
      });
      report(
        result,
        plural(result.succeeded, {
          one: 'Deleted # channel',
          other: 'Deleted # channels',
        }),
        t`${result.failed} of ${channels.length} channels failed to delete`,
      );
    },
    [queryClient, report, t],
  );

  return { duplicateChannels, deleteChannels };
};
