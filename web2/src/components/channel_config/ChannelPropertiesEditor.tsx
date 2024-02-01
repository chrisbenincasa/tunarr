import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  Box,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Snackbar,
  TextField,
  styled,
} from '@mui/material';
import { Channel } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import { isEmpty } from 'lodash-es';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import useStore from '../../store/index.ts';
import ChannelEditActions from './ChannelEditActions.tsx';

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

  const { control } = useFormContext<Channel>();

  const [channelIcon, setChannelIcon] = useState(channel?.icon.path);

  const [, channelIconPreview, setChannelIconPreview] = useDebouncedState(
    channel?.icon.path,
    250,
  );

  useEffect(() => {
    if (!prevChannel && channel) {
      const url = isEmpty(channel.icon.path)
        ? `/dizquetv.png`
        : channel.icon.path;
      setChannelIcon(url);
      setChannelIconPreview(url);
    }
  }, [prevChannel, channel, setChannelIcon, setChannelIconPreview]);

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
    <>
      <Snackbar />
      {channel && (
        <>
          <Controller
            name="number"
            control={control}
            rules={{ required: true }}
            render={({ field, formState: { errors } }) => (
              <TextField
                fullWidth
                label="Channel Number"
                margin="normal"
                helperText={errors.number ? 'Channel number is required' : null}
                {...field}
              />
            )}
          />
          <Controller
            name="name"
            control={control}
            rules={{ required: 'Channel name is required' }}
            render={({ field, formState: { errors } }) => (
              <TextField
                fullWidth
                label="Channel Name"
                margin="normal"
                helperText={errors.name ? 'Channel name is required' : null}
                {...field}
              />
            )}
          />
          <Controller
            name="groupTitle"
            control={control}
            rules={{ required: 'Channel group is required' }}
            render={({ field, formState: { errors } }) => (
              <TextField
                fullWidth
                label="Channel Group"
                margin="normal"
                helperText={
                  errors.groupTitle ? 'Channel group is required' : null
                }
                {...field}
              />
            )}
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
          <ChannelEditActions />
        </>
      )}
    </>
  );
}
