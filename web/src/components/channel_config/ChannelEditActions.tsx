import { useChannelEditor } from '@/store/selectors.ts';
import { Save } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import type {
  Mutation,
  MutationState,
  MutationStatus,
} from '@tanstack/react-query';
import { useMutationState } from '@tanstack/react-query';
import type { SaveableChannel } from '@tunarr/types';
import { isUndefined, last } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useEffect, useState } from 'react';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';

type ChannelEditActionsProps = {
  isNewChannel: boolean;
};

export default function ChannelEditActions({
  isNewChannel,
}: ChannelEditActionsProps) {
  const { currentEntity: channel } = useChannelEditor();
  const {
    formState: { isValid, isDirty, isSubmitting },
    reset,
  } = useChannelFormContext();
  const [lastState, setLastState] = useState<MutationStatus>('idle');
  const snackbar = useSnackbar();

  const mutationState = useMutationState<
    MutationState<unknown, Error, SaveableChannel>
  >({
    filters: {
      mutationKey: ['channels', isNewChannel ? 'create' : 'update'],
      predicate: (mutation: Mutation<unknown, Error, SaveableChannel>) =>
        mutation.state.variables?.id === channel?.id,
    },
  });
  const currentState = last(mutationState)?.status;

  useEffect(() => {
    if (!isUndefined(currentState) && currentState !== lastState) {
      setLastState(currentState);

      if (lastState === 'pending') {
        if (currentState === 'success' && !isNewChannel) {
          snackbar.enqueueSnackbar('Channel settings saved!', {
            variant: 'success',
          });
        } else if (currentState === 'error') {
          snackbar.enqueueSnackbar(
            <span>
              Error updating channel.
              <br />
              Check browser console for details
            </span>,
            {
              variant: 'error',
              autoHideDuration: 6000,
            },
          );
        }
      }
    }
  }, [isNewChannel, currentState, lastState, snackbar]);

  return (
    <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
      {!isNewChannel ? (
        <>
          {isDirty && (
            <Button onClick={() => reset()} variant="outlined">
              Reset Changes
            </Button>
          )}
          <Button
            disabled={!isValid || !isDirty || isSubmitting}
            variant="contained"
            type="submit"
            startIcon={
              isSubmitting ? (
                <CircularProgress
                  size="20px"
                  sx={{ mx: 1, color: 'inherit' }}
                />
              ) : (
                <Save />
              )
            }
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <Button
            disabled={!isValid || isSubmitting}
            variant="contained"
            type="submit"
            startIcon={
              isSubmitting ? (
                <CircularProgress
                  size="20px"
                  sx={{ mx: 1, color: 'inherit' }}
                />
              ) : (
                <Save />
              )
            }
          >
            Save
          </Button>
        </>
      )}
    </Stack>
  );
}
