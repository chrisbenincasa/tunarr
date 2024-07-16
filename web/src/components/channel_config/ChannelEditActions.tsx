import { Save } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { SaveChannelRequest } from '@tunarr/types';
import { useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import {
  Mutation,
  MutationState,
  useMutationState,
  MutationStatus,
} from '@tanstack/react-query';
import { useChannelEditor } from '@/store/selectors.ts';
import { isUndefined, last } from 'lodash-es';
import { useSnackbar } from 'notistack';

type ChannelEditActionsProps = {
  isNewChannel: boolean;
};

export default function ChannelEditActions({
  isNewChannel,
}: ChannelEditActionsProps) {
  const { currentEntity: channel } = useChannelEditor();
  // const { channelEditorState } = useContext(ChannelEditContext)!;
  const {
    formState: { isValid, isDirty, isSubmitting },
    reset,
  } = useFormContext<SaveChannelRequest>();
  const [lastState, setLastState] = useState<MutationStatus>('idle');
  const snackbar = useSnackbar();

  const mutationState = useMutationState<
    MutationState<unknown, Error, SaveChannelRequest>
  >({
    filters: {
      mutationKey: ['channels', isNewChannel ? 'create' : 'update'],
      predicate: (mutation: Mutation<unknown, Error, SaveChannelRequest>) =>
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
