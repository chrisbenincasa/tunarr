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
import { ChangeEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { apiClient } from '../../external/api.ts';
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

const DefaultIconPath = '/tunarr.png';

export default function ChannelPropertiesEditor() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const prevChannel = usePrevious(channel);

  const { control } = useFormContext<Channel>();

  const [channelIcon, setChannelIcon] = useState(channel?.icon.path);
  const previousIconPath = usePrevious(channelIcon);

  const [, channelIconPreview, setChannelIconPreview] = useDebouncedState(
    channel?.icon.path,
    250,
  );

  useEffect(() => {
    if (!prevChannel && channel) {
      const url = isEmpty(channel.icon.path)
        ? DefaultIconPath
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
    if (e.target.files && e.target.files.length > 0) {
      const data = new FormData();
      const file = e.target.files[0];
      const idx = file.name.lastIndexOf('.');
      let newName: string;

      if (idx === -1) {
        newName = `${channel!.id}_icon`;
      } else {
        const ext = file.name.slice(idx + 1);
        newName = `${channel!.id}_icon.${ext}`;
      }

      const renamedFile = new File(
        [file.slice(0, file.size, file.type)],
        newName,
        {
          type: file.type,
        },
      );

      data.append('file', renamedFile);

      apiClient
        .uploadImage({ file: renamedFile })
        .then((response) => {
          setChannelIcon(response.data.fileUrl);
        })
        .catch((err) => {
          console.error(err);
          setChannelIcon(previousIconPath ?? DefaultIconPath);
          setChannelIconPreview(previousIconPath ?? DefaultIconPath);
        });

      setChannelIconPreview(URL.createObjectURL(file));
    }
  };

  const onThumbUrlChange = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      setChannelIcon(e.target.value);
      setChannelIconPreview(e.target.value);
    },
    [setChannelIcon, setChannelIconPreview],
  );

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
                onChange={onThumbUrlChange}
                endAdornment={
                  <InputAdornment position="end">
                    <IconButton component="label">
                      <CloudUploadIcon />
                      <VisuallyHiddenInput
                        onChange={(e) => handleFileUpload(e)}
                        type="file"
                        accept="image/*"
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
