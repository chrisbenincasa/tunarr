import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { useContext } from 'react';
import { ChannelEditContext } from '../../pages/channels/EditChannelContext.ts';

export default function ChannelEditActions() {
  const { channelEditorState } = useContext(ChannelEditContext)!;

  return (
    <Stack spacing={2} direction="row" justifyContent="right" sx={{ mt: 2 }}>
      {!channelEditorState.isNewChannel ? (
        <>
          <Button variant="outlined">Reset Options</Button>
          <Button variant="contained" type="submit">
            Save
          </Button>
        </>
      ) : (
        <>
          <Button variant="contained">Next</Button>
          <Button variant="contained" type="submit">
            Save
          </Button>
        </>
      )}
    </Stack>
  );
}
