import {
  Box,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import dayjs from 'dayjs';
import { useCallback, useEffect, useRef } from 'react';
import { Controller } from 'react-hook-form';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';
import { useChannels } from '../../hooks/useChannels.ts';
import useStore from '../../store/index.ts';
import TunarrLogo from '../TunarrLogo.tsx';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import { NumericFormControllerText } from '../util/TypedController.tsx';

const DefaultIconPath = '';

export function ChannelPropertiesEditor() {
  const imgRef = useRef<HTMLImageElement | null>(null);
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const {
    control,
    watch,
    getValues,
    setValue,
    formState: { defaultValues },
  } = useChannelFormContext();
  const { data: channels } = useChannels();

  const onloadstart = () => {};

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

  const isChannelFormat = (str: string) => {
    // Regex to match "Channel 123" format
    const regex = /\bChannel\s\d+\b/;
    return regex.test(str);
  };

  const updateChannelNumber = (str: string, newNumber: number) => {
    // Check if the string matches the channel format
    if (!isChannelFormat(str)) {
      return str; // Return original string if not a channel format
    }

    // Capture the existing number using a capturing group
    const regex = /\bChannel\s(\d+)\b/;
    const match = regex.exec(str);

    if (match) {
      // Replace the captured number with the new number
      const updatedStr = str.replace(regex, `Channel ${newNumber}`);
      return updatedStr;
    }

    // No match found, return original string
    return str;
  };

  const handleChannelNumberChange = (value: number) => {
    const allValues = getValues(); // Get all form values

    if (isChannelFormat(allValues.name)) {
      const channelName = updateChannelNumber(allValues.name, value);
      setValue('name', channelName);
    }
  };

  const validateNumber = (value: number) => {
    if (isNaN(value)) {
      return 'Not a valid number';
    }

    if (value <= 0) {
      return 'Cannot use a channel number <= 0';
    }

    // TODO: We could probably use the touched fields property of the form here.
    if (value === defaultValues?.number) {
      return;
    }

    return channels.find((channel) => channel.number === Number(value))
      ? 'This channel number has already been used'
      : undefined;
  };

  return (
    channel && (
      <>
        <Box>
          <Stack spacing={3} divider={<Divider />}>
            <Box>
              <Typography variant="h5">General</Typography>
              <NumericFormControllerText
                name="number"
                control={control}
                rules={{
                  required: true,
                  validate: validateNumber,
                  onChange: (e: React.ChangeEvent<HTMLInputElement>) =>
                    handleChannelNumberChange(Number(e.target.value)),
                }}
                TextFieldProps={{
                  fullWidth: true,
                  label: 'Channel Number',
                  margin: 'normal',
                }}
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
                    helperText={`This is used by iptv clients to categorize the channels. You can leave it as 'tunarr' if you don't need this sort of classification.
                  ${errors.groupTitle ? 'Channel group is required' : ''}`}
                    {...field}
                  />
                )}
              />
              <Controller
                name="startTime"
                control={control}
                render={({ field }) => (
                  <DateTimePicker
                    label="Programming Start"
                    slotProps={{
                      textField: {
                        margin: 'normal',
                        fullWidth: true,
                        onBlur: field.onBlur,
                      },
                    }}
                    value={dayjs(field.value)}
                    onChange={(newDateTime) =>
                      field.onChange(+(newDateTime ?? dayjs()))
                    }
                  />
                )}
              />
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
                      // TODO Pop a toast or something
                      onUploadError={console.error}
                    />
                  )}
                />
              </Box>
            </Box>
            <Stack gap={2}>
              <Typography variant="h5">On-Demand</Typography>
              <Typography variant="body2">
                On-Demand channels resume from where you left off. Programming
                is paused when the channel is not streaming.
                <br />
                <strong>NOTE:</strong> While the channel is inactive, the TV
                Guide for the channel will be empty.
              </Typography>
              <Controller
                control={control}
                name="onDemand.enabled"
                render={({ field }) => (
                  <FormControlLabel
                    control={
                      <Switch
                        checked={field.value}
                        onChange={(e) => field.onChange(e.target.checked)}
                      />
                    }
                    label="Enabled"
                  />
                )}
              />
            </Stack>
          </Stack>
        </Box>
      </>
    )
  );
}
