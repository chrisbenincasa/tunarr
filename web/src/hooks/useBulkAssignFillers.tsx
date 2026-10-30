import { Plural, Trans, useLingui } from '@lingui/react/macro';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import {
  bulkAssignFillersMutation,
  getChannelsByNumberV2Options,
} from '../generated/@tanstack/react-query.gen.ts';
import { getApiErrorMessage } from '../helpers/apiError.ts';

export const DefaultBulkFillerWeight = 50;
export const DefaultBulkFillerCooldownSeconds = 30;

export function useBulkAssignFillers(onSuccess: () => void) {
  const { t } = useLingui();
  const queryClient = useQueryClient();
  const snackbar = useSnackbar();

  return useMutation({
    ...bulkAssignFillersMutation(),
    onSuccess: (data, variables) => {
      snackbar.enqueueSnackbar({
        message: (
          <Trans>
            Added {data.added}{' '}
            <Plural value={data.added} one="assignment" other="assignments" />,
            updated {data.updated}.
          </Trans>
        ),
        variant: 'success',
      });
      for (const channelId of variables.body.channelIds) {
        queryClient
          .invalidateQueries({
            queryKey: getChannelsByNumberV2Options({ path: { id: channelId } })
              .queryKey,
          })
          .catch(console.error);
      }
      onSuccess();
    },
    onError: (e) => {
      const message = getApiErrorMessage(e) ?? e.message;
      snackbar.enqueueSnackbar({
        message: t`Error assigning fillers: ${message}`,
        variant: 'error',
      });
    },
  });
}
