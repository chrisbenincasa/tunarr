import { useSystemState } from '@/hooks/useSystemSettings.ts';
import type { SelectChangeEvent } from '@mui/material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  InputLabel,
  MenuItem,
  Link as MuiLink,
  Select,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
  FfmpegSettings,
  TranscodeConfig,
  TupleToUnion,
} from '@tunarr/types';
import { defaultFfmpegSettings } from '@tunarr/types';
import { FfmpegLogLevels } from '@tunarr/types/schemas';
import { capitalize, isEmpty, isEqual, isNull, map, some } from 'lodash-es';
import { useSnackbar } from 'notistack';
import { useState } from 'react';
import type { SubmitHandler } from 'react-hook-form';
import { Controller, useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';

import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog.tsx';
import { LanguagePreferencesList } from '@/components/LanguagePreferencesList';
import type { DeepRequired } from 'ts-essentials';
import { TranscodeConfigsTable } from '../../components/settings/ffmpeg/TranscodeConfigsTable.tsx';
import {
  deleteApiTranscodeConfigsByIdMutation,
  getApiFfmpegInfoOptions,
  getApiFfmpegInfoQueryKey,
  getApiFfmpegSettingsQueryKey,
  getApiVersionQueryKey,
  putApiFfmpegSettingsMutation,
} from '../../generated/@tanstack/react-query.gen.ts';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';

const FfmpegLogOptions = ['disable', 'console', 'file'] as const;
type FfmpegLogOptions = TupleToUnion<typeof FfmpegLogOptions>;

type FfmpegFormValues = DeepRequired<Omit<FfmpegSettings, 'configVersion'>>;

export default function FfmpegSettingsPage() {
  const { data: ffmpegSettings, error } = useFfmpegSettings();
  const ffmpegInfo = useQuery({
    ...getApiFfmpegInfoOptions(),
  });

  const queryClient = useQueryClient();
  const systemState = useSystemState();

  const [confirmDeleteTranscodeConfig, setConfirmDeleteTranscodeConfig] =
    useState<TranscodeConfig | null>(null);

  const {
    reset,
    setValue,
    control,
    formState: { isDirty, isValid, isSubmitting },
    handleSubmit,
    watch,
  } = useForm<FfmpegFormValues>({
    defaultValues: {
      ...defaultFfmpegSettings,
      ...ffmpegSettings,
      transcodeDirectory: ffmpegSettings.transcodeDirectory ?? '',
    },
  });

  const [ffmpegConsoleLoggingEnabled, ffmpegFileLoggingEnabled] = watch([
    'enableLogging',
    'enableFileLogging',
  ]);

  let logSelectValue: FfmpegLogOptions = 'disable';
  if (ffmpegFileLoggingEnabled) {
    logSelectValue = 'file';
  } else if (ffmpegConsoleLoggingEnabled) {
    logSelectValue = 'console';
  }

  const handleFfmpegLogChange = (value: string) => {
    let logValue: FfmpegLogOptions;
    if (!FfmpegLogOptions.some((v) => v === value)) {
      logValue = 'disable';
    } else {
      logValue = value as FfmpegLogOptions;
    }

    if (logValue === logSelectValue) {
      return;
    }

    switch (logValue) {
      case 'disable':
        setValue('enableLogging', false, { shouldDirty: true });
        setValue('enableFileLogging', false, { shouldDirty: true });
        break;
      case 'console':
        setValue('enableLogging', true, { shouldDirty: true });
        setValue('enableFileLogging', false, { shouldDirty: true });
        break;
      case 'file':
        setValue('enableLogging', false, { shouldDirty: true });
        setValue('enableFileLogging', true, { shouldDirty: true });
        break;
    }
  };

  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);

  const snackbar = useSnackbar();

  const updateFfmpegSettingsMutation = useMutation({
    ...putApiFfmpegSettingsMutation(),
    // mutationFn: apiClient.updateFfmpegSettings,
    onSuccess: (data) => {
      setRestoreTunarrDefaults(false);
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        predicate(query) {
          return some(
            [
              getApiFfmpegSettingsQueryKey(),
              getApiFfmpegInfoQueryKey(),
              getApiVersionQueryKey(),
            ],
            (key) => isEqual(query.queryKey, key),
          );
        },
      });
    },
  });

  const deleteTranscodeConfig = useMutation({
    ...deleteApiTranscodeConfigsByIdMutation(),
    // mutationFn: (id: string) =>
    //   apiClient.deleteTranscodeConfig(undefined, { params: { id } }),
  });

  const updateFfmpegSettings: SubmitHandler<
    Omit<FfmpegSettings, 'configVersion'>
  > = (data) => {
    updateFfmpegSettingsMutation.mutate({
      body: {
        configVersion: defaultFfmpegSettings.configVersion,
        ...data,
      },
    });
  };

  if (error || ffmpegInfo.isPending || ffmpegInfo.isError) {
    return <div></div>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(updateFfmpegSettings)}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Global Options
      </Typography>
      <Stack spacing={3} useFlexGap sx={{ mb: 2 }}>
        {!systemState.data.isInContainer && (
          <>
            <FormControl fullWidth>
              <Controller
                control={control}
                name="ffmpegExecutablePath"
                render={({ field }) => (
                  <TextField
                    id="ffmpeg-executable-path"
                    label="FFmpeg Executable Path"
                    helperText={
                      'FFmpeg version 7.1+ recommended. Check your current version in the sidebar'
                    }
                    {...field}
                  />
                )}
              />
            </FormControl>
            <FormControl fullWidth>
              <Controller
                control={control}
                name="ffprobeExecutablePath"
                render={({ field }) => (
                  <TextField
                    id="ffprobe-executable-path"
                    label="FFprobe Executable Path"
                    helperText={
                      'FFprobe version 6.0+ recommended. Check your current version in the sidebar'
                    }
                    {...field}
                  />
                )}
              />
            </FormControl>
          </>
        )}
        <Stack spacing={2} useFlexGap>
          <Stack spacing={2} direction={{ sm: 'column', md: 'row' }}>
            <FormControl sx={{ flexBasis: '50%' }}>
              <InputLabel id="ffmpeg-logging-label">
                FFMPEG Log Method
              </InputLabel>
              <Select<(typeof FfmpegLogOptions)[number]>
                labelId="ffmpeg-logging-label"
                id="ffmpeg-logging"
                label="FFMPEG Log Method"
                value={logSelectValue}
                onChange={(e: SelectChangeEvent<FfmpegLogOptions>) =>
                  handleFfmpegLogChange(e.target.value)
                }
              >
                <MenuItem value="disable">Disabled</MenuItem>
                <MenuItem value="console">Console</MenuItem>
                <MenuItem value="file">File</MenuItem>
              </Select>

              <FormHelperText>
                Enable ffmpeg logging to different sinks. Outputting to a file
                will create a new log file for every spawned ffmpeg process in
                the Tunarr log directory. These files are automatically cleaned
                up by a background process.
              </FormHelperText>
            </FormControl>
            {logSelectValue !== 'disable' && (
              <FormControl sx={{ flex: 1 }}>
                <InputLabel id="ffmpeg-logging-level">
                  FFMPEG Log Level
                </InputLabel>
                <Controller
                  control={control}
                  name="logLevel"
                  render={({ field }) => (
                    <Select
                      labelId="ffmpeg-logging-level"
                      id="ffmpeg-logging-level"
                      label="FFMPEG Log Level"
                      {...field}
                    >
                      {map(FfmpegLogLevels, (level) => (
                        <MenuItem key={level} value={level}>
                          {capitalize(level)}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />

                <FormHelperText>
                  Log level to pass to ffmpeg. Read more about ffmpeg's log
                  levels{' '}
                  <MuiLink
                    target="_blank"
                    href="https://ffmpeg.org/ffmpeg.html#:~:text=%2Dloglevel%20%5Bflags%2B%5Dloglevel%20%7C%20%2Dv%20%5Bflags%2B%5Dloglevel"
                  >
                    here
                  </MuiLink>
                </FormHelperText>
              </FormControl>
            )}
          </Stack>
        </Stack>
        <FormControl sx={{ flexBasis: { xs: '100%', md: '50%' } }}>
          <InputLabel id="hls-direct-output-format-label">
            HLS Direct Output Format
          </InputLabel>
          <Controller
            control={control}
            name="hlsDirectOutputFormat"
            render={({ field }) => (
              <Select
                id="hls-direct-output-format"
                label="HLS Direct Output Format"
                labelId="hls-direct-output-format-label"
                {...field}
              >
                <MenuItem value="mkv">MKV</MenuItem>
                <MenuItem value="mp4">MP4</MenuItem>
                <MenuItem value="mpegts">MPEG-TS</MenuItem>
              </Select>
            )}
          />
          <FormHelperText>
            Channels configured to use the HLS Direct stream mode will output in
            the selected container format.
          </FormHelperText>
        </FormControl>
        <FormControl fullWidth>
          <Controller
            control={control}
            name="transcodeDirectory"
            render={({ field }) => (
              <TextField
                id="ffmpeg-transcode-path"
                label="FFmpeg Transcode Path"
                helperText={
                  <span>
                    Configure the directory where Tunarr writes HLS segment
                    files when transcoding. Tunarr will create the target
                    directory (but not intermediate directories) if it doesn't
                    exist.
                    <br />
                    Changing this field will only affect new sessions. Existing
                    sessions will continue writing to the previous setting, but
                    will clean out segments when the segment ends.
                    <br />
                    When unset, Tunarr will write segments to its current
                    working directory.
                  </span>
                }
                {...field}
              />
            )}
          />
        </FormControl>
      </Stack>
      <Divider sx={{ my: 1 }} />
      <Typography variant="h5" sx={{ mb: 2 }}>
        Audio &amp; Subtitle Options
      </Typography>
      <Stack spacing={3} sx={{ mb: 2 }}>
        <Box>
          <Typography variant="h6">Subtitles</Typography>
          <FormControl fullWidth>
            <Controller
              control={control}
              name="enableSubtitleExtraction"
              render={({ field }) => (
                <FormControlLabel
                  control={<Switch {...field} checked={field.value} />}
                  label="Enable embedded subtitle extraction"
                />
              )}
            />

            <FormHelperText>
              Enabling embedded subtitle extaction will periodically scan your
              upcoming programming for embedded text-based subtitle streams and
              extract them to a local cache. This is necessary in order to
              enable subtitle burning for text-based subtitles which are not
              external streams.
            </FormHelperText>
          </FormControl>
        </Box>

        <Divider />
        <Typography variant="h6" sx={{ mt: 2, mb: 1 }}>
          Audio Language Preferences
        </Typography>
        <Typography variant="subtitle1" sx={{ mb: 2 }}>
          Configure preferred audio languages globally.
        </Typography>
        <FormControl fullWidth>
          <Controller
            control={control}
            name="languagePreferences.preferences"
            rules={{
              validate: {
                minLength: (v) =>
                  isEmpty(v)
                    ? 'Must define at least one language preference'
                    : undefined,
              },
            }}
            render={({ field, fieldState: { error } }) => (
              <LanguagePreferencesList
                preferences={
                  field.value ?? [{ iso6391: 'en', displayName: 'English' }]
                }
                onChange={field.onChange}
                error={error}
              />
            )}
          />
        </FormControl>
      </Stack>
      <Stack spacing={2} direction="row" justifyContent="right">
        {(isDirty || (isDirty && !isSubmitting) || restoreTunarrDefaults) && (
          <Button
            variant="outlined"
            onClick={() => {
              reset(ffmpegSettings);
              setRestoreTunarrDefaults(false);
            }}
          >
            Reset Changes
          </Button>
        )}
        <Button
          variant="contained"
          disabled={
            !isValid || isSubmitting || (!isDirty && !restoreTunarrDefaults)
          }
          type="submit"
        >
          Save
        </Button>
      </Stack>
      <Divider sx={{ mt: 2 }} />

      <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
        Transcoding Configs
      </Typography>
      <Typography variant="subtitle1">
        Configure transcoding settings for Tunarr's streams. Each channel is
        assigned one transcode configuration.
      </Typography>
      <TranscodeConfigsTable />
      <UnsavedNavigationAlert isDirty={isDirty} />
      <DeleteConfirmationDialog
        open={!isNull(confirmDeleteTranscodeConfig)}
        title={`Delete Transcoding Config "${confirmDeleteTranscodeConfig?.name}"?`}
        body="All channels assigned to this config will be set to use the default configuration. If this is the last configuration, a new default configuration will be created."
        onConfirm={() =>
          deleteTranscodeConfig.mutate({
            path: { id: confirmDeleteTranscodeConfig!.id },
          })
        }
        onClose={() => setConfirmDeleteTranscodeConfig(null)}
        dialogProps={{
          maxWidth: 'sm',
          fullWidth: true,
        }}
      />
    </Box>
  );
}
