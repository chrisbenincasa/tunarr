import { Box, Snackbar, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Channel } from '@tunarr/types';
import { usePrevious } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import { isEmpty } from 'lodash-es';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import useDebouncedState from '../../hooks/useDebouncedState.ts';
import useStore from '../../store/index.ts';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import ChannelEditActions from './ChannelEditActions.tsx';

const DefaultIconPath = '/tunarr.png';

type Props = {
  isNew: boolean;
};

export default function ChannelPropertiesEditor({ isNew }: Props) {
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

  const onThumbUrlChange = useCallback(
    (value: string) => {
      setChannelIcon(value);
      setChannelIconPreview(value);
    },
    [setChannelIcon, setChannelIconPreview],
  );

  const renameFile = useCallback(
    (file: File) => {
      const idx = file.name.lastIndexOf('.');
      let newName: string;

      if (idx === -1) {
        newName = `${channel!.id}_icon`;
      } else {
        const ext = file.name.slice(idx + 1);
        newName = `${channel!.id}_icon.${ext}`;
      }
      return newName;
    },
    [channel],
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

          {isNew && (
            <Controller
              name="startTime"
              control={control}
              render={({ field }) => (
                <DateTimePicker
                  label="Programming Start"
                  slotProps={{
                    textField: { margin: 'normal', fullWidth: true },
                  }}
                  disablePast
                  value={dayjs(field.value)}
                  onChange={(newDateTime) =>
                    field.onChange((newDateTime ?? dayjs()).unix() * 1000)
                  }
                />
              )}
            />
          )}

          <Box sx={{ display: 'flex', alignItems: 'end' }}>
            <Box
              component="img"
              width="10%"
              src={channelIconPreview}
              sx={{ mr: 1 }}
              ref={imgRef}
            />
            <ImageUploadInput
              FormControlProps={{ fullWidth: true, margin: 'normal' }}
              value={channelIcon ?? DefaultIconPath}
              onFormValueChange={onThumbUrlChange}
              fileRenamer={renameFile}
              label="Thumbnail URL"
              onUploadError={() =>
                onThumbUrlChange(previousIconPath ?? DefaultIconPath)
              }
              onPreviewValueChange={setChannelIconPreview}
            />
          </Box>
          <ChannelEditActions />
        </>
      )}
    </>
  );
}
