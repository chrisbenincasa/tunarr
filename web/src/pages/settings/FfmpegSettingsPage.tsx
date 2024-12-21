import { useSystemSettingsSuspense } from '@/hooks/useSystemSettings.ts';
import { Delete, Edit } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormHelperText,
  IconButton,
  InputLabel,
  MenuItem,
  Link as MuiLink,
  Select,
  SelectChangeEvent,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import {
  FfmpegSettings,
  TranscodeConfig,
  TupleToUnion,
  defaultFfmpegSettings,
} from '@tunarr/types';
import { FfmpegLogLevels } from '@tunarr/types/schemas';
import { capitalize, isEqual, isNull, map, some } from 'lodash-es';
import {
  MRT_ColumnDef,
  MRT_Row,
  MaterialReactTable,
  useMaterialReactTable,
} from 'material-react-table';
import { useSnackbar } from 'notistack';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, SubmitHandler, useForm } from 'react-hook-form';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { CheckboxFormController } from '../../components/util/TypedController.tsx';

import { DeleteConfirmationDialog } from '@/components/DeleteConfirmationDialog.tsx';
import {
  useFfmpegSettings,
  useTranscodeConfigs,
} from '../../hooks/settingsHooks.ts';
import { useApiQuery } from '../../hooks/useApiQuery.ts';
import { useTunarrApi } from '../../hooks/useTunarrApi.ts';

const FfmpegLogOptions = ['disable', 'console', 'file'] as const;
type FfmpegLogOptions = TupleToUnion<typeof FfmpegLogOptions>;

// const supportedDeinterlaceFilters: {
//   value: DeinterlaceFilterValue;
//   string: string;
// }[] = [
//   { value: 'none', string: 'Disabled' },
//   { value: 'bwdif=0', string: 'bwdif send frame' },
//   { value: 'bwdif=1', string: 'bwdif send field' },
//   { value: 'w3fdif', string: 'w3fdif' },
//   { value: 'yadif=0', string: 'yadif send frame' },
//   { value: 'yadif=1', string: 'yadif send field' },
// ];

// type ScalingAlgorithmValue = 'bicubic' | 'fast_bilinear' | 'lanczos' | 'spline';

// const supportedScalingAlgorithm: ScalingAlgorithmValue[] = [
//   'bicubic',
//   'fast_bilinear',
//   'lanczos',
//   'spline',
// ];

export default function FfmpegSettingsPage() {
  const apiClient = useTunarrApi();
  const { data, isPending, error } = useFfmpegSettings();
  const ffmpegInfo = useApiQuery({
    queryKey: ['ffmpeg-info'],
    queryFn: (apiClient) => apiClient.getFfmpegInfo(),
  });

  const systemSettings = useSystemSettingsSuspense();
  const transcodeConfigs = useTranscodeConfigs();

  const [confirmDeleteTranscodeConfig, setConfirmDeleteTranscodeConfig] =
    useState<TranscodeConfig | null>(null);

  const {
    reset,
    setValue,
    control,
    formState: { isDirty, isValid, isSubmitting },
    handleSubmit,
    watch,
  } = useForm<Omit<FfmpegSettings, 'configVersion'>>({
    defaultValues: defaultFfmpegSettings,
    mode: 'onBlur',
  });

  const [ffmpegConsoleLoggingEnabled, ffmpegFileLoggingEnabled] = watch([
    'enableLogging',
    'enableFileLogging',
    'hardwareAccelerationMode',
    'useNewFfmpegPipeline',
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

  useEffect(() => {
    if (data) {
      reset(data);
    }
  }, [data, reset]);

  const [restoreTunarrDefaults, setRestoreTunarrDefaults] = useState(false);

  const snackbar = useSnackbar();
  const queryClient = useQueryClient();

  const updateFfmpegSettingsMutation = useMutation({
    mutationFn: apiClient.updateFfmpegSettings,
    onSuccess: (data) => {
      setRestoreTunarrDefaults(false);
      snackbar.enqueueSnackbar('Settings Saved!', {
        variant: 'success',
      });
      reset(data, { keepValues: true });
      return queryClient.invalidateQueries({
        predicate(query) {
          return some(
            [['settings', 'ffmpeg-settings'], ['ffmpeg-info']],
            (key) => isEqual(query.queryKey, key),
          );
        },
      });
    },
  });

  const deleteTranscodeConfig = useMutation({
    mutationFn: (id: string) =>
      apiClient.deleteTranscodeConfig(undefined, { params: { id } }),
  });

  const updateFfmpegSettings: SubmitHandler<
    Omit<FfmpegSettings, 'configVersion'>
  > = (data) => {
    updateFfmpegSettingsMutation.mutate({
      configVersion: defaultFfmpegSettings.configVersion,
      ...data,
    });
  };

  const rows = useMemo(() => {
    return transcodeConfigs.data;
  }, [transcodeConfigs.data]);

  const columns = useMemo<MRT_ColumnDef<TranscodeConfig>[]>(() => {
    return [
      {
        header: 'Name',
        accessorKey: 'name',
      },
      {
        header: 'Resolution',
        accessorFn(originalRow) {
          return `${originalRow.resolution.widthPx}x${originalRow.resolution.heightPx}`;
        },
      },
      {
        header: 'Video Format',
        accessorKey: 'videoFormat',
      },
      {
        header: 'Audio Format',
        accessorKey: 'audioFormat',
      },
    ];
  }, []);

  const renderRowActions = useCallback(
    ({ row: { original: config } }: { row: MRT_Row<TranscodeConfig> }) => {
      return (
        <Box sx={{ display: 'flex', justifyContent: 'end', width: '100%' }}>
          <Tooltip title="Edit" placement="top">
            <IconButton to={`/settings/ffmpeg/${config.id}`} component={Link}>
              <Edit />
            </IconButton>
          </Tooltip>
          <Tooltip title="Delete" placement="top">
            <IconButton onClick={() => setConfirmDeleteTranscodeConfig(config)}>
              <Delete />
            </IconButton>
          </Tooltip>
        </Box>
      );
    },
    [],
  );

  const table = useMaterialReactTable({
    data: rows,
    columns,
    renderRowActions,
    enableRowActions: true,
    displayColumnDefOptions: {
      'mrt-row-actions': {
        size: 100,
        grow: false,
        Header: '',
        visibleInShowHideMenu: false,
      },
    },
    positionActionsColumn: 'last',
  });

  if (isPending || error || ffmpegInfo.isPending || ffmpegInfo.isError) {
    return <div></div>;
  }

  return (
    <Box component="form" onSubmit={handleSubmit(updateFfmpegSettings)}>
      <Typography variant="h5" sx={{ mb: 2 }}>
        Global Options
      </Typography>
      <Stack spacing={3} useFlexGap>
        {!systemSettings.data.adminMode && (
          <Alert severity="info">
            Tunarr must be run in admin mode in order to update the FFmpeg and
            FFprobe executable paths. The paths can also be updated from the
            command line.
          </Alert>
        )}
        <FormControl fullWidth>
          <Controller
            control={control}
            name="ffmpegExecutablePath"
            disabled={!systemSettings.data.adminMode}
            render={({ field }) => (
              <TextField
                id="ffmpeg-executable-path"
                label="FFmpeg Executable Path"
                helperText={
                  'FFmpeg version 6.0+ recommended. Check your current version in the sidebar'
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
            disabled={!systemSettings.data.adminMode}
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
          <FormControl fullWidth>
            <FormControlLabel
              control={
                <CheckboxFormController
                  control={control}
                  name="useNewFfmpegPipeline"
                />
              }
              label={
                <span>
                  <strong>Experimental: </strong> Use new FFmpeg Pipeline
                </span>
              }
            />
            <FormHelperText>
              Generate FFmpeg commands using Tunarr's new FFmpeg pipeline code.
              The new code is more advanced than the original pipeline code. If
              using hardware acceleration, the new code attempts to push as much
              of the pipeline onto hardware as possible whereas the original
              code would only encode using hardware. However, this code is still
              considered experimental as bugs are discovered and fixed.
              <br />
              Additionally, some options on this page will change (or disappear)
              when using the new pipeline code.
            </FormHelperText>
          </FormControl>
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
        <Stack spacing={2} direction="row" justifyContent="right">
          {(isDirty || (isDirty && !isSubmitting) || restoreTunarrDefaults) && (
            <Button
              variant="outlined"
              onClick={() => {
                reset(data);
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
      </Stack>
      <Divider sx={{ mt: 2 }} />
      <Typography variant="h5" sx={{ mt: 2, mb: 1 }}>
        Transcoding Configs
      </Typography>
      <Typography variant="subtitle1">
        Configure transcoding settings for Tunarr's streams. Each channel is
        assigned one transcode configuration.
      </Typography>
      <MaterialReactTable table={table} />
      <UnsavedNavigationAlert isDirty={isDirty} />
      <DeleteConfirmationDialog
        open={!isNull(confirmDeleteTranscodeConfig)}
        title={`Delete Transcoding Config "${confirmDeleteTranscodeConfig?.name}"?`}
        body="All channels assigned to this config will be set to use the default configuration. If this is the last configuration, a new default configuration will be created."
        onConfirm={() =>
          deleteTranscodeConfig.mutate(confirmDeleteTranscodeConfig!.id)
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
