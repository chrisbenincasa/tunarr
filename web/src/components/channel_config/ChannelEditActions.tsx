import { Save } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { SaveChannelRequest } from '@tunarr/types';
import { useContext, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';
import {
  Mutation,
  MutationState,
  useMutationState,
  MutationStatus,
} from '@tanstack/react-query';
import { useChannelEditor } from '@/store/selectors.ts';
import { isUndefined, last } from 'lodash-es';
import { useSnackbar } from 'notistack';

export default function ChannelEditActions() {
  const { currentEntity: channel } = useChannelEditor();
  const { channelEditorState } = useContext(ChannelEditContext)!;
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
      mutationKey: [
        'channels',
        channelEditorState.isNewChannel ? 'create' : 'update',
      ],
      predicate: (mutation: Mutation<unknown, Error, SaveChannelRequest>) =>
        mutation.state.variables?.id === channel?.id,
    },
  });
  const currentState = last(mutationState)?.status;

  useEffect(() => {
    if (!isUndefined(currentState) && currentState !== lastState) {
      setLastState(currentState);

      if (lastState === 'pending') {
        if (currentState === 'success' && !channelEditorState.isNewChannel) {
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
  }, [channelEditorState.isNewChannel, currentState, lastState, snackbar]);

  return (
    <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
      {!channelEditorState.isNewChannel ? (
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
