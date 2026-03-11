import {
  Add,
  Delete,
  FirstPage,
  LastPage,
  LowPriority,
  Repeat,
} from '@mui/icons-material';
import {
  Autocomplete,
  Box,
  Button,
  Divider,
  FormControl,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';
import { seq } from '@tunarr/shared/util';
import type {
  BaseSlot,
  FillerPlaybackMode,
  SlotFiller,
} from '@tunarr/types/api';
import { SlotFillerTypes } from '@tunarr/types/api';
import { find, isEmpty, map } from 'lodash-es';
import { useCallback, useMemo } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { slotOrderOptions } from '../../helpers/slotSchedulerUtil.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

const ALL_FILLER_TYPES = SlotFillerTypes.options;

type RowProps = {
  index: number;
};

const SlotFillerOrder = ({ index }: RowProps) => {
  const { control, watch } = useFormContext<{
    fillerConfig: { fillers: SlotFiller[] };
  }>();

  return (
    <Grid size={{ xs: 12 }}>
      <Stack direction="row" flex={1} sx={{ ml: 3 }} spacing={2}>
        <Controller
          control={control}
          name={`fillerConfig.fillers.${index}.fillerOrder`}
          render={({ field }) => {
            const opts = slotOrderOptions('filler');
            const helperText = find(opts, {
              value: field.value,
            })?.helperText;
            return (
              <FormControl fullWidth>
                <InputLabel>Order</InputLabel>
                <Select label="Order" {...field}>
                  {map(opts, ({ description, value }) => (
                    <MenuItem key={value} value={value}>
                      {description}
                    </MenuItem>
                  ))}
                </Select>
                {helperText && <FormHelperText>{helperText}</FormHelperText>}
              </FormControl>
            );
          }}
        />
        <Controller
          control={control}
          name={`fillerConfig.fillers.${index}.playbackMode`}
          render={({ field }) => {
            const mode = (field.value ?? {
              type: 'relaxed',
            }) as FillerPlaybackMode;
            return (
              <>
                <FormControl fullWidth>
                  <InputLabel>Playback Mode</InputLabel>
                  <Select
                    label="Playback Mode"
                    value={mode.type}
                    onChange={(e) => {
                      const t = e.target.value as FillerPlaybackMode['type'];
                      switch (t) {
                        case 'relaxed':
                          field.onChange({ type: 'relaxed' });
                          break;
                        case 'count':
                          field.onChange({ type: 'count', count: 1 });
                          break;
                        case 'duration':
                          field.onChange({
                            type: 'duration',
                            durationMs: 30000,
                          });
                          break;
                        case 'random_count':
                          field.onChange({ type: 'random_count' });
                          break;
                      }
                    }}
                  >
                    <MenuItem value="relaxed">Relaxed</MenuItem>
                    <MenuItem value="count">Count</MenuItem>
                    <MenuItem value="duration">Duration</MenuItem>
                    <MenuItem value="random_count">Random Count</MenuItem>
                  </Select>
                  <FormHelperText>
                    <Box component="ul" sx={{ pl: 1 }}>
                      <li>
                        <strong>Relaxed:</strong> play filler freely until the
                        slot's remaining time is filled.
                      </li>
                      <li>
                        <strong>Count:</strong> play exactly N filler items.
                      </li>
                      <li>
                        <strong>Duration:</strong> play filler up to a fixed
                        time duration.
                      </li>
                      <li>
                        <strong>Random Count:</strong> play a random number of
                        filler items between an optional min and max.
                      </li>
                    </Box>
                  </FormHelperText>
                </FormControl>
                {mode.type === 'count' && (
                  <TextField
                    label="Count"
                    type="number"
                    value={mode.count}
                    slotProps={{
                      htmlInput: { min: 1 },
                    }}
                    onChange={(e) =>
                      field.onChange({
                        type: 'count',
                        count: Math.max(1, parseInt(e.target.value, 10) || 1),
                      })
                    }
                  />
                )}
                {mode.type === 'duration' && (
                  <TextField
                    label="Duration (seconds)"
                    type="number"
                    value={mode.durationMs / 1000}
                    slotProps={{
                      htmlInput: { min: 1 },
                    }}
                    onChange={(e) =>
                      field.onChange({
                        type: 'duration',
                        durationMs: Math.max(
                          1000,
                          (parseFloat(e.target.value) || 1) * 1000,
                        ),
                      })
                    }
                  />
                )}
                {mode.type === 'random_count' && (
                  <Stack direction="row" spacing={1}>
                    <TextField
                      label="Min"
                      type="number"
                      value={mode.min ?? ''}
                      placeholder="1"
                      slotProps={{
                        htmlInput: { min: 1 },
                      }}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        field.onChange({
                          ...mode,
                          min: isNaN(val) ? undefined : Math.max(1, val),
                        });
                      }}
                    />
                    <TextField
                      label="Max"
                      type="number"
                      value={mode.max ?? ''}
                      placeholder="all"
                      slotProps={{
                        htmlInput: { min: 1 },
                      }}
                      onChange={(e) => {
                        const val = parseInt(e.target.value, 10);
                        field.onChange({
                          ...mode,
                          max: isNaN(val) ? undefined : Math.max(1, val),
                        });
                      }}
                    />
                  </Stack>
                )}
              </>
            );
          }}
        />
      </Stack>
    </Grid>
  );
};

export const SlotFillerDialogPanel = () => {
  const { control, watch } = useFormContext<{
    fillerConfig: { fillers: SlotFiller[] };
    type: BaseSlot['type'];
  }>();
  const fillerFields = useFieldArray({ control, name: 'fillerConfig.fillers' });
  const { data: fillerLists } = useFillerLists();

  const fillerFieldValues = watch('fillerConfig.fillers');

  // Set of "listId:type" combos already in use
  const usedCombos = useMemo(
    () =>
      new Set(
        seq.collect(fillerFieldValues, (f) =>
          f?.fillerListId && f?.type ? `${f.fillerListId}:${f.type}` : null,
        ),
      ),
    [fillerFieldValues],
  );

  const maxCombos = fillerLists.length * ALL_FILLER_TYPES.length;

  const handleAddNewFillerEntry = useCallback(() => {
    for (const list of fillerLists) {
      for (const type of ALL_FILLER_TYPES) {
        if (!usedCombos.has(`${list.id}:${type}`)) {
          fillerFields.append({
            type,
            fillerListId: list.id,
            fillerOrder: 'shuffle_prefer_short',
            playbackMode: { type: 'relaxed' },
          });
          return;
        }
      }
    }
  }, [fillerLists, usedCombos, fillerFields]);

  if (fillerLists.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2} sx={{ mb: 2 }}>
      <Button
        startIcon={<Add />}
        variant="outlined"
        disabled={isEmpty(fillerLists) || usedCombos.size >= maxCombos}
        onClick={handleAddNewFillerEntry}
      >
        Add filler
      </Button>
      {fillerFields.fields.map((fillerField, idx) => (
        <>
          <Grid
            container
            spacing={2}
            key={fillerField.id}
            sx={{ alignItems: 'center' }}
          >
            <Grid size={{ xs: 4 }}>
              <Controller
                control={control}
                name={`fillerConfig.fillers.${idx}.fillerListId` as const}
                rules={{ required: true }}
                render={({ field }) => (
                  <Autocomplete
                    fullWidth
                    disableClearable
                    options={fillerLists}
                    getOptionKey={(list) => list.id}
                    getOptionLabel={(list) => list.name}
                    value={find(fillerLists, { id: field.value })}
                    onChange={(_, list) => field.onChange(list?.id)}
                    renderInput={(params) => (
                      <TextField {...params} label="Filler List" />
                    )}
                    sx={{ flex: 1 }}
                  />
                )}
              />
            </Grid>
            <Grid size="auto">
              <Controller
                control={control}
                name={`fillerConfig.fillers.${idx}.type`}
                rules={{ required: true }}
                render={({ field }) => (
                  <ToggleButtonGroup
                    key={fillerField.id}
                    exclusive
                    value={field.value}
                    onChange={(_, value) => {
                      if (value !== null) field.onChange(value);
                    }}
                    sx={{ width: '100%' }}
                  >
                    <ToggleButton value="head">
                      <FirstPage />
                      Head
                    </ToggleButton>
                    <ToggleButton value={'pre'}>
                      <LowPriority
                        sx={{
                          rotate: '180deg',
                          transform: 'scale(-1, 1)',
                          mr: 1,
                        }}
                      />{' '}
                      Pre
                    </ToggleButton>
                    <ToggleButton value="post">
                      <LowPriority sx={{ mr: 1 }} /> Post
                    </ToggleButton>
                    <ToggleButton value="tail">
                      <LastPage sx={{ mr: 1 }} /> Tail
                    </ToggleButton>
                    <ToggleButton value="fallback">
                      <Repeat /> Fallback
                    </ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </Grid>
            <Grid size="auto" offset="auto" justifyContent="flex-end">
              <IconButton
                onClick={() => fillerFields.remove(idx)}
                disableRipple
              >
                <Delete />{' '}
              </IconButton>
            </Grid>
            <SlotFillerOrder index={idx} />
          </Grid>
          {idx < fillerFields.fields.length - 1 && <Divider />}
        </>
      ))}
    </Stack>
  );
};
