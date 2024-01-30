import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  Box,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  TextField,
  styled,
} from '@mui/material';
import { usePrevious } from '@uidotdev/usehooks';
import { isEmpty } from 'lodash-es';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import { updateCurrentChannel } from '../../store/channelEditor/actions.ts';
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
  const imgRef = useRef<HTMLImageElement | null>(null);
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const prevChannel = usePrevious(channel);

  const [channelName, debounceChannelName, setChannelName] = useDebouncedState(
    channel?.name ?? '',
    250,
  );

  const [channelNumber, debounceChannelNumber, setChannelNumber] =
    useDebouncedState(channel?.number ?? 1, 250);

  const [channelIcon, setChannelIcon] = useState(channel?.icon.path);

  const [, channelIconPreview, setChannelIconPreview] = useDebouncedState(
    channel?.icon.path,
    250,
  );

  useEffect(() => {
    if (!prevChannel && channel) {
      setChannelName(channel.name);
      setChannelNumber(channel.number);
      const url = isEmpty(channel.icon.path)
        ? `/dizquetv.png`
        : channel.icon.path;
      setChannelIcon(url);
      setChannelIconPreview(url);
    }
  }, [
    prevChannel,
    channel,
    setChannelName,
    setChannelNumber,
    setChannelIcon,
    setChannelIconPreview,
  ]);

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

  const onloadstart = () => {
    console.log('on load start');
  };

  useEffect(() => {
    if (imgRef.current) {
      const current = imgRef.current;
      current.onloadstart = onloadstart;
      return () => {
        current.removeEventListener('onloadstart', onloadstart);
      };
    }
  }, [imgRef]);

  const handleFileUpload = (e: ChangeEvent<HTMLInputElement>) => {
    console.log(e.target.files);
    if (e.target.files && e.target.files.length > 0) {
      const file = e.target.files[0];
      setChannelIcon(`http://localhost:8000/images/uploads/${file.name}`); // Placeholder
      setChannelIconPreview(URL.createObjectURL(file));
    }
  };

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
        <Box sx={{ display: 'flex', alignItems: 'end' }}>
          <Box
            component="img"
            width="10%"
            src={channelIconPreview}
            sx={{ mr: 1 }}
            ref={imgRef}
          />
          <FormControl fullWidth margin="normal">
            <InputLabel>Thumbnail URL</InputLabel>
            <OutlinedInput
              label="Thumbnail URL"
              value={channelIcon}
              type="url"
              onChange={(e) => setChannelIcon(e.target.value)}
              endAdornment={
                <InputAdornment position="end">
                  <IconButton component="label">
                    <CloudUploadIcon />
                    <VisuallyHiddenInput
                      onChange={(e) => handleFileUpload(e)}
                      type="file"
                    />
                  </IconButton>
                </InputAdornment>
              }
            />
          </FormControl>
        </Box>
      </Box>
    )
  );
}
