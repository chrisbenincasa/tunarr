import {
  FormControl,
  InputAdornment,
  InputLabel,
  MenuItem,
  Select,
  Stack,
} from '@mui/material';
import type { TranscodeConfig } from '@tunarr/types';
import type { SupportedTranscodeAudioOutputFormats } from '@tunarr/types/schemas';
import { Controller, useFormContext } from 'react-hook-form';
import type { DropdownOption } from '../../../helpers/DropdownOption';
import { NumericFormControllerText } from '../../util/TypedController.tsx';

const AudioFormats: DropdownOption<SupportedTranscodeAudioOutputFormats>[] = [
  {
    description: 'AAC',
    value: 'aac',
  },
  {
    description: 'AC3',
    value: 'ac3',
  },
  {
    description: 'MP3',
    value: 'mp3',
  },
  {
    description: 'Copy',
    value: 'copy',
  },
] as const;

export const TranscodeConfigAudioSettingsForm = () => {
  const { control, watch } = useFormContext<TranscodeConfig>();
  const encoder = watch('audioFormat');

  return (
    <Stack gap={2}>
      <FormControl fullWidth>
        <InputLabel>Audio Format</InputLabel>
        <Controller
          control={control}
          name="audioFormat"
          render={({ field }) => (
            <Select<SupportedTranscodeAudioOutputFormats>
              label="Audio Format"
              {...field}
            >
              {AudioFormats.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          )}
        />
      </FormControl>

      <Stack direction={{ sm: 'column', md: 'row' }} gap={2} useFlexGap>
        <NumericFormControllerText
          control={control}
          name="audioBitRate"
          prettyFieldName="Audio Bitrate"
          TextFieldProps={{
            id: 'audio-bitrate',
            label: 'Audio Bitrate',
            fullWidth: true,
            disabled: encoder === 'copy',
            helperText:
              encoder === 'copy'
                ? 'Bitrate cannot be changed when copying input audio'
                : null,
            InputProps: {
              endAdornment: (
                <InputAdornment position="end">kbps</InputAdornment>
              ),
            },
          }}
        />
        <NumericFormControllerText
          control={control}
          name="audioBufferSize"
          prettyFieldName="Audio Buffer Size"
          TextFieldProps={{
            id: 'audio-buffer-size',
            label: 'Audio Buffer Size',
            fullWidth: true,
            disabled: encoder === 'copy',
            helperText:
              encoder === 'copy'
                ? 'Buffer size cannot be changed when copying input audio'
                : null,
            InputProps: {
              endAdornment: <InputAdornment position="end">kb</InputAdornment>,
            },
          }}
        />
      </Stack>
      <Stack direction={{ sm: 'column', md: 'row' }} gap={2} useFlexGap>
        <NumericFormControllerText
          control={control}
          name="audioVolumePercent"
          prettyFieldName="Audio Volume Percent"
          TextFieldProps={{
            id: 'audio-volume',
            label: 'Audio Volume',
            fullWidth: true,
            sx: { my: 1 },
            helperText: 'Values higher than 100 will boost the audio.',
            InputProps: {
              endAdornment: <InputAdornment position="end">%</InputAdornment>,
            },
          }}
        />
        <NumericFormControllerText
          control={control}
          name="audioChannels"
          prettyFieldName="Audio Channels"
          TextFieldProps={{
            id: 'audio-bitrate',
            label: 'Audio Channels',
            fullWidth: true,
            sx: { my: 1 },
          }}
        />
      </Stack>

      <NumericFormControllerText
        control={control}
        name="audioSampleRate"
        prettyFieldName="Audio Sample Rate"
        TextFieldProps={{
          id: 'audio-sample-rate',
          label: 'Audio Sample Rate',
          fullWidth: true,
          disabled: encoder === 'copy',
          helperText:
            encoder === 'copy'
              ? 'Sample rate cannot be changed when copying input audio'
              : null,
          sx: { my: 1 },
          InputProps: {
            endAdornment: <InputAdornment position="end">kHz</InputAdornment>,
          },
        }}
      />
    </Stack>
  );
};
