import { Delete } from '@mui/icons-material';
import {
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  Skeleton,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';
import { SaveChannelRequest } from '@tunarr/types';
import {
  chain,
  find,
  isNumber,
  map,
  pullAt,
  range,
  round,
  some,
  sumBy,
} from 'lodash-es';
import { useCallback, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { Link as RouterLink } from '@tanstack/react-router';
import { useDebounceCallback } from 'usehooks-ts';
import { typedProperty } from '../../helpers/util.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import useStore from '../../store/index.ts';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';

export function ChannelFlexConfig() {
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const { data: fillerLists, isPending: fillerListsLoading } = useFillerLists();
  const { control, watch } = useFormContext<SaveChannelRequest>();
  const collectionControls = useFieldArray({
    control,
    name: 'fillerCollections',
    keyName: 'formId', // Filler lists already claim the "id" field
  });
  const channelFillerLists = collectionControls.fields;

  const [offlineMode, offlinePicture] = watch([
    'offline.mode',
    // 'fillerCollections',
    'offline.picture',
  ]);
  const [weights, setWeights] = useState<number[]>(
    map(channelFillerLists, 'weight'),
  );

  const updateFormWeights = useDebounceCallback(
    useCallback(() => {
      collectionControls.replace(
        map(channelFillerLists, (cfl, idx) => ({
          ...cfl,
          weight: weights[idx],
        })),
      );
    }, [channelFillerLists, collectionControls, weights]),
    100,
  );

  const addFillerList = useCallback(
    (id: string) => {
      if (id === '_unused') {
        return;
      }
      const oldLists = channelFillerLists ? [...channelFillerLists] : [];

      const newWeight = round(100 / (oldLists.length + 1), 2);
      const distributeWeight = round((100 - newWeight) / oldLists.length, 2);
      const newLists = [
        {
          id,
          cooldownSeconds: 30,
          weight: newWeight,
        },
        ...map(oldLists, (list) => ({
          ...list,
          weight: list.weight - distributeWeight,
        })),
      ];

      setWeights(map(newLists, 'weight'));
      collectionControls.replace(newLists);
    },
    [channelFillerLists, collectionControls],
  );

  const removeSelectedFillerList = useCallback(
    (idx: number) => {
      if (!channelFillerLists) {
        return;
      }

      const removed = pullAt(channelFillerLists, idx);
      const removedWeight = sumBy(removed, 'weight');
      const distributeWeight =
        channelFillerLists.length > 0
          ? round(removedWeight / channelFillerLists.length, 2)
          : 0;
      const newLists = map(channelFillerLists, (list) => ({
        ...list,
        weight: list.weight + distributeWeight,
      }));

      setWeights(map(newLists, 'weight'));
      collectionControls.replace(newLists);
    },
    [channelFillerLists, collectionControls],
  );

  const adjustWeights = useCallback(
    (idx: number, value: string | number, upscaleAmt: number) => {
      if (!channelFillerLists) {
        return;
      }

      let newWeight = isNumber(value) ? value : parseInt(value);
      if (isNaN(newWeight)) {
        return;
      }
      newWeight /= upscaleAmt;

      const newRemainingWeight = 100 - newWeight;
      const distributedWeight = round(
        newRemainingWeight / (channelFillerLists.length - 1),
        4,
      );

      setWeights(
        map(range(channelFillerLists.length), (i) =>
          i === idx ? newWeight : distributedWeight,
        ),
      );

      updateFormWeights();
    },
    [channelFillerLists, updateFormWeights],
  );

  const renderFillerLists = () => {
    if (!channelFillerLists || channelFillerLists.length === 0) {
      return null;
    }

    const unclaimedLists = chain(fillerLists)
      .reject((list) => some(channelFillerLists, { id: list.id }))
      .map((list) => (
        <MenuItem key={list.id} value={list.id}>
          {list.name}
        </MenuItem>
      ))
      .value();

    return map(channelFillerLists, (cfl, index) => {
      const actualList = find(fillerLists, { id: cfl.id })!;
      const thisListOpt = (
        <MenuItem key={cfl.id} value={cfl.id}>
          {actualList.name}
        </MenuItem>
      );

      const listOpts = [thisListOpt, ...unclaimedLists];

      return (
        <Grid container key={cfl.id} sx={{ mb: 2 }} columnSpacing={2}>
          <Grid item xs={2}>
            <FormControl key={cfl.id} sx={{ width: '100%' }}>
              <Select value={cfl.id} disabled={unclaimedLists.length === 0}>
                {listOpts}
              </Select>
            </FormControl>
          </Grid>
          <Grid item>
            <Controller
              control={control}
              name={`fillerCollections.${index}.cooldownSeconds`}
              rules={{ min: 0, max: 525600 }}
              render={({ field }) => (
                <TextField label="Cooldown (seconds)" {...field} />
              )}
            />
          </Grid>
          {channelFillerLists && channelFillerLists.length > 1 && (
            <Grid item xs={5}>
              <FormControl sx={{ width: '100%', mb: 1 }} key={cfl.id}>
                <Grid container spacing={2}>
                  <Grid item xs={9}>
                    <Slider
                      min={0}
                      max={1000}
                      value={weights[index] * 10}
                      // Gnarly - we cast onChange to the void so react-form-hook
                      // doesn't try to do anything. Instead we wait for the onChangeCommited
                      // event, which fires on onMouseUp, and then handle the change.
                      onChange={(_, value) =>
                        adjustWeights(index, value as number, 10)
                      }
                      onChangeCommitted={(_, value) =>
                        adjustWeights(index, value as number, 10)
                      }
                    />
                  </Grid>
                  <Grid item xs>
                    <TextField
                      type="number"
                      label="Weight %"
                      value={weights[index]}
                      disabled
                    />
                  </Grid>
                </Grid>
              </FormControl>
            </Grid>
          )}
          <Grid item alignSelf={'center'}>
            <IconButton onClick={() => removeSelectedFillerList(index)}>
              <Delete />
            </IconButton>
          </Grid>
        </Grid>
      );
    });
  };

  const renderAddFillerListEditor = () => {
    if (!fillerLists) {
      return null;
    }

    if (fillerLists.length === 0) {
      return (
        <Typography>
          You haven't created any filler lists yet! Go to the{' '}
          <Link component={RouterLink} to="/library/fillers">
            Filler Lists
          </Link>{' '}
          page to create one.
        </Typography>
      );
    }

    const unclaimedLists = chain(fillerLists)
      .reject((list) => some(channelFillerLists, { id: list.id }))
      .map((list) => (
        <MenuItem key={list.id} value={list.id}>
          {list.name}
        </MenuItem>
      ))
      .value();

    const opts = [
      <MenuItem key="null" value="_unused">
        {unclaimedLists.length === 0
          ? 'All lists are used'
          : 'Add a Filler List'}
      </MenuItem>,
      ...unclaimedLists,
    ];

    return (
      <FormControl sx={{ mb: 1 }}>
        <InputLabel>Filler List</InputLabel>
        <Select
          value="_unused"
          label="Filler List"
          onChange={(e) => addFillerList(e.target.value)}
          disabled={unclaimedLists.length === 0}
        >
          {opts}
        </Select>
      </FormControl>
    );
  };

  return (
    channel && (
      <>
        <Box>
          <Box>
            <Box>
              <Typography variant="h5" sx={{ mb: 1 }}>
                Filler Content
              </Typography>
              <Typography variant="body1" sx={{ mb: 2 }}>
                Videos from filler lists will be picked randomly to play during
                channel offline time. Videos from the filler list will be
                randomly picked to play unless there are cooldown restrictions
                to place or if no videos are short enough for the remaining Flex
                time.
              </Typography>
              {!fillerListsLoading && renderFillerLists()}
              {fillerListsLoading ? <Skeleton /> : renderAddFillerListEditor()}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Filler Options
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
          <Divider sx={{ my: 2 }} />
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
                  src={offlinePicture}
                  sx={{ mr: 1 }}
                />
              </Box>
            )}
            <Stack direction="column" sx={{ flexGrow: 1 }} gap={1}>
              <Controller
                name="offline.mode"
                control={control}
                render={({ field }) => (
                  <FormControl fullWidth sx={{ mb: 1 }}>
                    <InputLabel>Fallback Mode</InputLabel>
                    <Select fullWidth label="Fallback Mode" {...field}>
                      <MenuItem value={'pic'}>Picture</MenuItem>
                      <MenuItem disabled value={'clip'}>
                        Library Clip (not yet implemented)
                      </MenuItem>
                    </Select>
                  </FormControl>
                )}
              />
              <Controller
                name="offline.picture"
                control={control}
                render={({ field }) => (
                  <ImageUploadInput
                    // TODO: This should be something like {channel.id}_fallback_picture.ext
                    fileRenamer={typedProperty('name')}
                    label="Picture"
                    onFormValueChange={(newPath) => {
                      field.onChange(newPath);
                    }}
                    onUploadError={console.error}
                    FormControlProps={{ fullWidth: true, sx: { mb: 1 } }}
                    value={field.value ?? ''}
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
        </Box>
      </>
    )
  );
}
