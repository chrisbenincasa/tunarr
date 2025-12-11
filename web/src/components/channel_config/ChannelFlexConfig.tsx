import { DefaultFallbackPicturePath } from '@/helpers/constants.ts';
import { useSettings } from '@/store/settings/selectors.ts';
import { Delete } from '@mui/icons-material';
import {
  Checkbox,
  Divider,
  FormControl,
  FormControlLabel,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Skeleton,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import Box from '@mui/material/Box';
import {
  find,
  isNumber,
  isUndefined,
  map,
  pullAt,
  range,
  reject,
  round,
  some,
  sumBy,
} from 'lodash-es';
import { useCallback, useState } from 'react';
import { Controller, useFieldArray } from 'react-hook-form';
import { useDebounceCallback } from 'usehooks-ts';
import { isNonEmptyString, typedProperty } from '../../helpers/util.ts';
import { useChannelFormContext } from '../../hooks/useChannelFormContext.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';
import useStore from '../../store/index.ts';
import { RouterLink } from '../base/RouterLink.tsx';
import { ImageUploadInput } from '../settings/ImageUploadInput.tsx';
import { NumericFormController } from '../util/TypedController.tsx';

export function ChannelFlexConfig() {
  const { backendUri } = useSettings();
  const channel = useStore((s) => s.channelEditor.currentEntity);
  const { data: fillerLists, isPending: fillerListsLoading } = useFillerLists();
  const { control, watch } = useChannelFormContext();
  const collectionControls = useFieldArray({
    control,
    name: 'fillerCollections',
    keyName: 'formId', // Filler lists already claim the "id" field
  });
  const channelFillerLists = collectionControls.fields;

  const [offlineMode, offlinePicture] = watch([
    'offline.mode',
    'offline.picture',
  ]);

  const offlinePictureSrc = isNonEmptyString(offlinePicture)
    ? offlinePicture
    : `${backendUri}${DefaultFallbackPicturePath}`;

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
      const distributeWeight = round(newWeight / oldLists.length, 2);
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
      const oldWeight = weights[idx];
      const scale = round((newWeight - oldWeight) / oldWeight, 2);
      if (scale === 0) {
        return;
      }
      const newRemainingWeight = 100 - newWeight;
      const oldRemainingWeight = 100 - oldWeight;

      const newWeights = map(range(channelFillerLists.length), (i) => {
        if (idx === i) {
          return newWeight;
        } else if (weights[i] === 0) {
          // If the adjusted slot is coming down from 100% weight
          // just distribute the remaining weight among the other slots
          return round(newRemainingWeight / (channelFillerLists.length - 1), 2);
        } else {
          // Take the percentage portion of the old weight
          // from the newRemainingWeight. This scales the weights
          // relative to their existing proportion.
          const prevWeight = weights[i];
          const prevPortion = round(prevWeight / oldRemainingWeight, 4);
          return round(newRemainingWeight * prevPortion, 2);
        }
      });

      setWeights(newWeights);

      updateFormWeights();
    },
    [channelFillerLists, updateFormWeights, weights],
  );

  const renderFillerLists = () => {
    if (!channelFillerLists || channelFillerLists.length === 0) {
      return null;
    }

    const unclaimedLists = reject(fillerLists, (list) =>
      some(channelFillerLists, { id: list.id }),
    ).map((list) => (
      <MenuItem key={list.id} value={list.id}>
        {list.name}
      </MenuItem>
    ));

    return map(channelFillerLists, (cfl, index) => {
      const actualList = find(fillerLists, { id: cfl.id });
      if (isUndefined(actualList)) {
        return null;
      }

      const thisListOpt = (
        <MenuItem key={cfl.id} value={cfl.id}>
          {actualList.name}
        </MenuItem>
      );

      const listOpts = [thisListOpt, ...unclaimedLists];

      return (
        <Grid container key={cfl.id} sx={{ mb: 2 }} columnSpacing={2}>
          <Grid size={{ xs: 3 }}>
            <FormControl key={cfl.id} sx={{ width: '100%' }}>
              <Select value={cfl.id} disabled={unclaimedLists.length === 0}>
                {listOpts}
              </Select>
            </FormControl>
          </Grid>
          <Grid>
            <NumericFormController
              control={control}
              name={`fillerCollections.${index}.cooldownSeconds`}
              rules={{ min: 0, max: 525600 }}
              render={({ field }) => (
                <TextField label="Cooldown (seconds)" {...field} />
              )}
            />
          </Grid>
          {channelFillerLists && channelFillerLists.length > 1 && (
            <Grid size={{ xs: 5 }}>
              <FormControl sx={{ width: '100%', mb: 1 }} key={cfl.id}>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 9 }}>
                    <Slider
                      min={0}
                      max={1000}
                      value={weights[index] * 10}
                      // Gnarly - we cast onChange to the void so react-form-hook
                      // doesn't try to do anything. Instead we wait for the onChangeCommited
                      // event, which fires on onMouseUp, and then handle the change.
                      onChange={(_, value) => adjustWeights(index, value, 10)}
                      onChangeCommitted={(_, value) =>
                        adjustWeights(index, value, 10)
                      }
                    />
                  </Grid>
                  <Grid>
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
          <Grid alignSelf={'center'}>
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
          <RouterLink to="/library/fillers">Filler Lists</RouterLink> page to
          create one.
        </Typography>
      );
    }

    const unclaimedLists = reject(fillerLists, (list) =>
      some(channelFillerLists, { id: list.id }),
    ).map((list) => (
      <MenuItem key={list.id} value={list.id}>
        {list.name}
      </MenuItem>
    ));

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
                Videos from the filler list will be randomly picked to play
                unless there are cooldown restrictions to place or if no videos
                are short enough for the remaining Flex time.
                <br />
                Each filler can be assigned a cooldown, which restricts how
                frequently the list will be chosen during flex time.
              </Typography>
              {!fillerListsLoading && renderFillerLists()}
              {fillerListsLoading ? <Skeleton /> : renderAddFillerListEditor()}
            </Box>
            <Divider sx={{ my: 2 }} />
            <Typography variant="h5" sx={{ mb: 1 }}>
              Filler Options
            </Typography>
            <Controller
              name="fillerRepeatCooldown"
              control={control}
              rules={{ validate: (v) => isNumber(v) && !isNaN(v) }}
              render={({ field, formState: { errors } }) => (
                <>
                  <TextField
                    fullWidth
                    label="Filler List Cooldown (seconds)"
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
                    Items from any filler list will not be chosen more
                    frequently than this cooldown setting.
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
                    control={<Checkbox {...field} checked={field.value} />}
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
                  src={offlinePictureSrc}
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
                      <MenuItem value={'pic'}>Image</MenuItem>
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
                    label="Image URL"
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
