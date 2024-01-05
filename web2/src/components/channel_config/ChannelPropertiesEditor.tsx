import {
  Box,
  Button,
  FormControl,
  OutlinedInput,
  TextField,
  styled,
} from '@mui/material';
import useStore from '../../store/index.ts';

const VisuallyHiddenInput = styled('input')({
  clip: 'rect(0 0 0 0)',
  clipPath: 'inset(50%)',
  height: 1,
  overflow: 'hidden',
  position: 'absolute',
  bottom: 0,
  left: 0,
  whiteSpace: 'nowrap',
  width: 1,
});

export default function ChannelPropertiesEditor() {
  const channel = useStore((s) => s.channelEditor.currentChannel);
  return (
    <Box>
      <TextField
        fullWidth
        label="Channel Number"
        value={channel?.number}
        margin="normal"
      />
      <TextField
        fullWidth
        label="Channel Name"
        value={channel?.name}
        margin="normal"
      />
      <TextField
        fullWidth
        label="Channel Group"
        value={channel?.groupTitle}
        margin="normal"
      />
      <FormControl>
        <OutlinedInput label="Thumbnail URL" value={channel?.icon.path} />
        <Button component="label" variant="contained">
          Upload file
          <VisuallyHiddenInput type="file" />
        </Button>
      </FormControl>
    </Box>
  );
}
