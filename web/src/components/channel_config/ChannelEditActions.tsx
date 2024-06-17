import { Save } from '@mui/icons-material';
import { CircularProgress, Snackbar } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { SaveChannelRequest } from '@tunarr/types';
import { useContext, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';
import { useUpdateChannel } from '@/hooks/useUpdateChannel.ts';
import {
  Mutation,
  MutationState,
  useMutationState,
  MutationStatus,
} from '@tanstack/react-query';
import { useChannelEditor } from '@/store/selectors.ts';
import { isUndefined, last } from 'lodash-es';

type SnackBar = {
  display: boolean;
  message: string;
  color: string;
};

export default function ChannelEditActions() {
  const { currentEntity: channel } = useChannelEditor();
  const { channelEditorState } = useContext(ChannelEditContext)!;
  const {
    formState: { isValid, isDirty, isSubmitting, isSubmitSuccessful },
    reset,
  } = useFormContext<SaveChannelRequest>();
  const updateChannelMutation = useUpdateChannel(
    channelEditorState.isNewChannel,
  );
  const [lastState, setLastState] = useState<MutationStatus>('idle');

  // console.log(updateChannelMutation);
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

  if (!isUndefined(currentState) && currentState !== lastState) {
    console.log('setting');
    setLastState(currentState);
  }

  const theme = useTheme();

  const [snackStatus, setSnackStatus] = useState<SnackBar>({
    display: false,
    color: '',
    message: '',
  });

  useEffect(() => {
    // new channels are automatically navigated to programming page so no need for snackbar there
    if (isSubmitSuccessful && !channelEditorState.isNewChannel) {
      setSnackStatus({
        display: true,
        message: 'Channel settings saved!',
        color: theme.palette.success.main,
      });
    }
  }, [
    channelEditorState.isNewChannel,
    isSubmitSuccessful,
    theme.palette.success.main,
  ]);

  const handleSnackClose = () => {
    setSnackStatus({ display: false, message: '', color: '' });
  };

  return (
    <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
      <Snackbar
        open={snackStatus.display}
        autoHideDuration={6000}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        onClose={handleSnackClose}
        message={snackStatus.message}
        sx={{ backgroundColor: snackStatus.color }}
      />
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
