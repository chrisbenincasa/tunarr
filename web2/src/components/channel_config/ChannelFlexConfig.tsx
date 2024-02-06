import {
  Divider,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';
import { Channel } from '@tunarr/types';
import { isNumber } from 'lodash-es';
import { Controller, useFormContext } from 'react-hook-form';
import useStore from '../../store/index.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import ChannelEditActions from './ChannelEditActions.tsx';

export function ChannelFlexConfig() {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const { control, watch } = useFormContext<Channel>();

  const offlineMode = watch('offline.mode');

  const { isPending: fillerListsLoading, fillerLists } = useFillerLists();

  return (
    channel && (
      <>
        <Box>
          <Typography variant="h5" sx={{ mb: 1 }}>
            Channel Fallback
          </Typography>
          <Typography variant="body1" sx={{ mb: 2 }}>
            Configure what appears on your channel when there is no suitable
            filler content available. Using channel fallbacks requires ffmpeg
            transcoding.
          </Typography>
          <Stack spacing={2} direction="row" sx={{ pb: 1 }}>
            {offlineMode === 'pic' && (
              <Box sx={{ flexBasis: '33%' }}>
                <Box
                  component="img"
                  width="100%"
                  src={
                    channel.offline.picture ??
                    'http://localhost:8000/images/generic-offline-screen.png'
                  }
                  sx={{ mr: 1 }}
                />
              </Box>
            )}
            <Stack direction="column" sx={{ flexGrow: 1 }}>
              <Controller
                name="offline.mode"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Fallback Mode</InputLabel>
                    <Select fullWidth label="Fallback Mode" {...field}>
                      <MenuItem value={'pic'}>Picture</MenuItem>
                      <MenuItem value={'clip'}>Library Clip</MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
              <Controller
                name="offline.picture"
                control={control}
                render={({ field }) => (
                  <TextField
                    fullWidth
                    sx={{ mb: 1 }}
                    label="Picture"
                    {...field}
                  />
                )}
              />
              <Controller
                name="offline.soundtrack"
                control={control}
                render={({ field }) => (
                  <TextField fullWidth label="Soundtrack" {...field} />
                )}
              />
            </Stack>
          </Stack>
          <Divider sx={{ my: 1 }} />
          <Box>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Filler
            </Typography>
            <Typography variant="body1">
              Select content to use as filler content in between programs on the
              channel's schedule.
            </Typography>
            <Controller
              name="fillerRepeatCooldown"
              control={control}
              rules={{ validate: isNumber }}
              render={({ field, formState: { errors } }) => (
                <>
                  <TextField
                    fullWidth
                    label="Filler Cooldown"
                    margin="normal"
                    helperText={
                      errors.fillerRepeatCooldown?.type === 'validate'
                        ? 'Filler cooldown must be a number'
                        : null
                    }
                    {...field}
                  />
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    Minimum time (minutes) before replaying a filler
                  </Typography>
                </>
              )}
            />
          </Box>
        </Box>
        <ChannelEditActions />
      </>
    )
  );
}
