import { Save } from '@mui/icons-material';
import { CircularProgress } from '@mui/material';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { SaveChannelRequest } from '@tunarr/types';
import { useContext } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';

export default function ChannelEditActions() {
  const { channelEditorState } = useContext(ChannelEditContext)!;
  const {
    formState: { isValid, isDirty, isSubmitting },
    reset,
  } = useFormContext<SaveChannelRequest>();

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
                <CircularProgress size="20px" sx={{ mx: 1, color: '#fff' }} />
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
                <CircularProgress size="20px" sx={{ mx: 1, color: '#fff' }} />
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
