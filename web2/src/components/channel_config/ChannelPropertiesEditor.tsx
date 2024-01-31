import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import {
  Box,
  Button,
  FormControl,
  IconButton,
  InputAdornment,
  InputLabel,
  OutlinedInput,
  Snackbar,
  Stack,
  TextField,
  styled,
} from '@mui/material';
import { usePrevious } from '@uidotdev/usehooks';
import { isEmpty } from 'lodash-es';
import { ChangeEvent, useEffect, useRef, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import useStore from '../../store/index.ts';
import { useMutation } from '@tanstack/react-query';
import { UpdateChannelRequest } from '@tunarr/types';
import { apiClient } from '../../external/api.ts';
import { setCurrentChannel } from '../../store/channelEditor/actions.ts';

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

type FormInputs = {
  name: string;
  number: number;
  groupName: string;
};

export default function ChannelPropertiesEditor() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const prevChannel = usePrevious(channel);

  const { control, setValue, handleSubmit } = useForm<FormInputs>({
    defaultValues: {
      name: '',
      groupName: 'tv',
      number: 1,
    },
  });

  const updateChannel = useMutation({
    mutationFn: async (channelUpdates: UpdateChannelRequest) => {
      return apiClient.updateChannel(channelUpdates, {
        params: { id: channel!.id },
      });
    },
  });

  const onSubmit: SubmitHandler<FormInputs> = (data) => {
    updateChannel.mutate(
      { ...data },
      {
        onSuccess: (result) => {
          setCurrentChannel(result);
        },
      },
    );
    console.log(data);
  };

  const [channelIcon, setChannelIcon] = useState(channel?.icon.path);

  const [, channelIconPreview, setChannelIconPreview] = useDebouncedState(
    channel?.icon.path,
    250,
  );

  useEffect(() => {
    if (!prevChannel && channel) {
      setValue('name', channel.name);
      setValue('number', channel.number, { shouldTouch: true });
      setValue('groupTitle', channel.groupTitle);
      const url = isEmpty(channel.icon.path)
        ? `/dizquetv.png`
        : channel.icon.path;
      setChannelIcon(url);
      setChannelIconPreview(url);
    }
  }, [prevChannel, channel, setValue, setChannelIcon, setChannelIconPreview]);

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
        <Box component="form" onSubmit={handleSubmit(onSubmit)}>
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
            rules={{ required: true }}
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
            rules={{ required: true }}
            render={({ field }) => (
              <TextField
                fullWidth
                label="Channel Group"
                margin="normal"
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
          <Stack
            spacing={2}
            direction="row"
            justifyContent="right"
            sx={{ mt: 2 }}
          >
            <Button variant="outlined">Reset Options</Button>
            <Button variant="contained" type="submit">
              Save
            </Button>
          </Stack>
        </Box>
      )}
    </>
  );
}
