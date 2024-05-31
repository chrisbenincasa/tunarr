import { Save } from '@mui/icons-material';
import { CircularProgress, Snackbar } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useTheme } from '@mui/material/styles';
import { SaveChannelRequest } from '@tunarr/types';
import { useContext, useEffect, useState } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';

type SnackBar = {
  display: boolean;
  message: string;
  color: string;
};

export default function ChannelEditActions() {
  const { channelEditorState } = useContext(ChannelEditContext)!;
  const {
    formState: { isValid, isDirty, isSubmitting, isSubmitSuccessful },
    reset,
  } = useFormContext<SaveChannelRequest>();
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
  }, [isSubmitSuccessful, theme.palette.success.main]);

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
