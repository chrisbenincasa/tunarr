import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { SaveChannelRequest } from '@tunarr/types';
import { useContext } from 'react';
import { useFormContext } from 'react-hook-form';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';

export default function ChannelEditActions() {
  const { channelEditorState } = useContext(ChannelEditContext)!;
  const {
    formState: { isValid, isDirty },
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
            disabled={!isValid || !isDirty}
            variant="contained"
            type="submit"
          >
            Save
          </Button>
        </>
      ) : (
        <>
          <Button disabled={!isValid} variant="contained" type="submit">
            Save
          </Button>
        </>
      )}
    </Stack>
  );
}
