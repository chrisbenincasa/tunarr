import { Box, Snackbar, TextField } from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Channel } from '@tunarr/types';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import useStore from '../../store/index.ts';
import TunarrLogo from '../TunarrLogo.tsx';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import ChannelEditActions from './ChannelEditActions.tsx';

const DefaultIconPath = '';

type Props = {
  isNew: boolean;
};

export default function ChannelPropertiesEditor({ isNew }: Props) {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const { control, watch } = useFormContext<Channel>();

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
  const imagePath = watch('icon.path');

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
            {DefaultIconPath !== imagePath ? (
              <Box
                component="img"
                width="10%"
                src={imagePath}
                sx={{ mr: 1 }}
                ref={imgRef}
              />
            ) : (
              <TunarrLogo style={{ width: '132px' }} />
            )}

            <Controller
              name="icon.path"
              control={control}
              render={({ field }) => (
                <ImageUploadInput
                  FormControlProps={{ fullWidth: true, margin: 'normal' }}
                  value={field.value}
                  onFormValueChange={(newPath) => {
                    field.onChange(newPath);
                  }}
                  fileRenamer={renameFile}
                  label="Thumbnail URL"
                  onUploadError={console.error}
                />
              )}
            />
          </Box>
          <ChannelEditActions />
        </>
      )}
    </>
  );
}
