import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useContext } from 'react';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';
import { useFormContext } from 'react-hook-form';
import { SaveChannelRequest } from '@tunarr/types';

export default function ChannelEditActions() {
  const { channelEditorState } = useContext(ChannelEditContext)!;
  const {
    formState: { isValid, isDirty },
    reset,
  } = useFormContext<SaveChannelRequest>();

  console.log(isValid, isDirty);

  return (
    <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
      {!channelEditorState.isNewChannel ? (
        <>
          <Button onClick={() => reset()} variant="outlined">
            Reset Options
          </Button>
          <Button
            disabled={!isValid || !isDirty}
            variant="contained"
            type="submit"
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <Button variant="contained">Next</Button>
          <Button
            disabled={!isValid || !isDirty}
            variant="contained"
            type="submit"
          >
            Save
          </Button>
        </>
      )}
    </Stack>
  );
}
