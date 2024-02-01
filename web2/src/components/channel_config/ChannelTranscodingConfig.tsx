import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { useFfmpegSettings } from '../../hooks/settingsHooks.ts';
import {
  CircularProgress,
  FormControl,
  Input,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  TextField,
} from '@mui/material';
import useStore from '../../store/index.ts';
import { isNil } from 'lodash-es';
import { toStringResolution } from '../../helpers/util.ts';
import { Controller, useFormContext } from 'react-hook-form';
import { Channel } from '@tunarr/types';

const resolutionOptions = [
  { value: '420x420', label: '420x420 (1:1)' },
  { value: '480x270', label: '480x270 (HD1080/16 16:9)' },
  { value: '576x320', label: '576x320 (18:10)' },
  { value: '640x360', label: '640x360 (nHD 16:9)' },
  { value: '720x480', label: '720x480 (WVGA 3:2)' },
  { value: '800x600', label: '800x600 (SVGA 4:3)' },
  { value: '1024x768', label: '1024x768 (WXGA 4:3)' },
  { value: '1280x720', label: '1280x720 (HD 16:9)' },
  { value: '1920x1080', label: '1920x1080 (FHD 16:9)' },
  { value: '3840x2160', label: '3840x2160 (4K 16:9)' },
];

export default function ChannelTranscodingConfig() {
  const { data: ffmpegSettings, isPending: ffmpegSettingsLoading } =
    useFfmpegSettings();

  const channel = useStore((s) => s.channelEditor.currentEntity);

  const { control } = useFormContext<Channel>();

  const resolution = channel?.transcoding?.targetResolution;

  const chosenResolution = !isNil(resolution)
    ? toStringResolution(resolution)
    : 'global';

  if (ffmpegSettingsLoading) {
    return <CircularProgress />;
  }

  const allResolutionOptions = [
    {
      value: 'global',
      label: `Use global setting: ${
        ffmpegSettings?.targetResolution
          ? toStringResolution(ffmpegSettings.targetResolution)
          : 'Unset'
      }`,
    },
    ...resolutionOptions,
  ];

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1 }}>
        <Typography>Transcoding Settings</Typography>
        <FormControl fullWidth margin="normal">
          <InputLabel>Channel Resolution</InputLabel>
          {ffmpegSettingsLoading ? (
            <Skeleton>
              <Input />
            </Skeleton>
          ) : (
            <Controller
              control={control}
              name="transcoding.targetResolution"
              render={({ field }) => (
                <Select
                  disabled={
                    isNil(ffmpegSettings) || !ffmpegSettings.enableTranscoding
                  }
                  label="Channel Resolution"
                  {...field}
                >
                  {allResolutionOptions.map((opt) => (
                    <MenuItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          )}
        </FormControl>
        <FormControl margin="normal">
          <TextField
            label="Video Bitrate (kbps)"
            value={ffmpegSettings?.videoBitrate}
          />
        </FormControl>
      </Box>
    </Box>
  );
}
