import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  TextField,
  styled,
} from '@mui/material';
import { isEmpty } from 'lodash-es';
import { usePrevious } from '@uidotdev/usehooks';
import { useEffect } from 'react';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import { updateCurrentChannel } from '../../store/channelEditor/actions.ts';
import useStore from '../../store/index.ts';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useDebounce } from 'usehooks-ts';

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
  const prevChannel = usePrevious(channel);

  const [channelName, debounceChannelName, setChannelName] = useDebouncedState(
    channel?.name ?? '',
    250,
  );

  const [channelNumber, debounceChannelNumber, setChannelNumber] =
    useDebouncedState(channel?.number ?? 1, 250);

  useEffect(() => {
    if (!prevChannel && channel) {
      setChannelName(channel.name);
      setChannelNumber(channel.number);
    }
  }, [prevChannel, channel, setChannelName, setChannelNumber]);

  useEffect(() => {
    if (
      channel &&
      channel.name !== debounceChannelName &&
      debounceChannelName.length > 0
    ) {
      updateCurrentChannel({ name: debounceChannelName });
    }
  }, [channel, debounceChannelName]);

  useEffect(() => {
    if (channel && channel.number !== debounceChannelNumber) {
      updateCurrentChannel({ number: debounceChannelNumber });
    }
  }, [channel, debounceChannelNumber]);

  return (
    channel && (
      <Box>
        <TextField
          fullWidth
          label="Channel Number"
          value={channelNumber}
          margin="normal"
        />
        <TextField
          fullWidth
          label="Channel Name"
          value={channelName}
          onChange={(e) => setChannelName(e.target.value)}
          margin="normal"
        />
        <TextField
          fullWidth
          label="Channel Group"
          value={channel.groupTitle}
          margin="normal"
        />
        <FormControl fullWidth margin="normal">
          <InputLabel>Thumbnail URL</InputLabel>
          <OutlinedInput
            label="Thumbnail URL"
            value={
              isEmpty(channel.icon.path) ? `/dizquetv.png` : channel.icon.path
            }
            endAdornment={
              <InputAdornment position="end">
                <IconButton component="label">
                  <CloudUploadIcon />
                  <VisuallyHiddenInput type="file" />
                </IconButton>
              </InputAdornment>
            }
          />
        </FormControl>
      </Box>
    )
  );
}
