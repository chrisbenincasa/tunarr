import {
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';
import { SaveChannelRequest } from '@tunarr/types';
import { chain, isNumber, some } from 'lodash-es';
import { useCallback } from 'react';
import { Controller, useFormContext } from 'react-hook-form';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import useStore from '../../store/index.ts';
import ChannelEditActions from './ChannelEditActions.tsx';
import { find } from 'lodash-es';

export function ChannelFlexConfig() {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const { data: fillerLists, isPending: fillerListsLoading } = useFillerLists();
  const { control, getValues, setValue, watch } =
    useFormContext<SaveChannelRequest>();

  const offlineMode = watch('offline.mode');
  const channelFillerLists = watch('fillerCollections');

  const addFillerList = useCallback(
    (id: string) => {
      if (id === '_unused') {
        return;
      }

      console.log(channelFillerLists);
      const newLists = channelFillerLists ? [...channelFillerLists] : [];
      newLists.push({
        id,
        cooldownSeconds: 100,
        weight: 0,
      });
      setValue('fillerCollections', newLists);
    },
    [fillerLists, setValue, channelFillerLists],
  );

  const renderFillerListEditor = () => {
    if (!fillerLists) {
      return null;
    }

    if (fillerLists.length === 0) {
      return <Typography>You haven't created any filler lists yet!</Typography>;
    }

    const opts = chain(fillerLists)
      .reject((list) => some(channelFillerLists, { id: list.id }))
      .map((list) => (
        <MenuItem key={list.id} value={list.id}>
          {list.name}
        </MenuItem>
      ))
      .value();

    opts.unshift(
      <MenuItem key="null" value="_unused">
        Add a Filler List
      </MenuItem>,
    );

    return (
      <>
        <FormControl sx={{ mb: 1 }}>
          <InputLabel>Filler List</InputLabel>
          <Controller
            control={control}
            name="fillerCollections"
            render={() => (
              <Select
                value="_unused"
                placeholder="Add a Filler List"
                label="Filler List"
                onChange={(e) => addFillerList(e.target.value)}
              >
                {opts}
              </Select>
            )}
          />
        </FormControl>
      </>
    );
  };

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
              rules={{ validate: (v) => isNumber(v) && !isNaN(v) }}
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
                    onChange={(e) => field.onChange(parseInt(e.target.value))}
                  />
                  <Typography variant="caption" sx={{ ml: 1 }}>
                    Minimum time (minutes) before replaying a filler
                  </Typography>
                </>
              )}
            />
            <Controller
              control={control}
              name="disableFillerOverlay"
              render={({ field }) => (
                <FormControl fullWidth margin="normal">
                  <FormControlLabel
                    control={<Checkbox {...field} />}
                    label="Hide watermark during filler"
                  />
                </FormControl>
              )}
            />
          </Box>
          <Divider sx={{ my: 1 }} />
          <Box>
            <Typography variant="h5" sx={{ mb: 1 }}>
              Filler Lists
            </Typography>
            {!fillerListsLoading &&
              (channelFillerLists ?? []).map((list) => (
                <Typography key={list.id}>
                  {find(fillerLists, { id: list.id })!.name}
                </Typography>
              ))}
            {fillerListsLoading ? <Skeleton /> : renderFillerListEditor()}
          </Box>
        </Box>
        <ChannelEditActions />
      </>
    )
  );
}
