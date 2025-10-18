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
import type { BaseSlot } from '@tunarr/types/api';
import { find, isEmpty, map, some } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { slotOrderOptions } from '../../helpers/slotSchedulerUtil.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

export const SlotFillerDialogPanel = () => {
  const { control, watch } = useFormContext<BaseSlot>();
  const fillerFields = useFieldArray({ control, name: 'filler' });
  const { data: fillerLists } = useFillerLists();

  const [chosenFillerLists, setChosenFillerLists] = useState<string[]>([]);

  // Insanely stupid hack we have to do in order to re-render on nested value
  // set.
  useEffect(() => {
    const { unsubscribe } = watch((value, info) => {
      if (
        value.type &&
        (value.type === 'movie' ||
          value.type === 'custom-show' ||
          value.type === 'show') &&
        info.name?.startsWith('filler')
      ) {
        const fillerListIds = seq.collect(
          value.filler,
          (filler) => filler?.fillerListId,
        );
        console.log(fillerListIds);
        setChosenFillerLists(fillerListIds);
      }
    });
    return () => unsubscribe();
  }, [watch]);

  const fillerListOptions = useMemo(() => {
    if (chosenFillerLists.length <= 1) {
      return fillerLists;
    }

    return fillerLists.filter(
      (list) => !some(chosenFillerLists, (field) => field === list.id),
    );
  }, [chosenFillerLists, fillerLists]);

  const handleAddNewFillerList = useCallback(() => {
    const unselected = fillerLists.find(
      (list) => !some(chosenFillerLists, (field) => field === list.id),
    );
    if (!unselected) {
      return;
    }

    fillerFields.append({
      types: ['pre'],
      fillerListId: unselected.id,
      fillerOrder: 'shuffle_prefer_short',
    });
  }, [fillerLists, fillerFields, chosenFillerLists]);

  if (fillerLists.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Button
        startIcon={<Add />}
        variant="outlined"
        disabled={isEmpty(fillerListOptions)}
        onClick={handleAddNewFillerList}
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
                name={`filler.${idx}.fillerListId` as const}
                rules={{ required: true }}
                render={({ field }) => (
                  <Autocomplete
                    fullWidth
                    disableClearable={true}
                    options={fillerListOptions}
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
                name={`filler.${idx}.types`}
                rules={{ validate: { nonempty: (v) => (v ?? []).length > 0 } }}
                render={({ field }) => (
                  <ToggleButtonGroup
                    key={fillerField.id}
                    value={field.value}
                    onChange={(_, formats) => field.onChange(formats)}
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
            {/* <Box sx={{ flexBasis: '100%', height: 0, p: 0, m: 0 }}></Box> */}
            <Grid size={{ xs: 6 }}>
              <Stack direction="row" flex={1} sx={{ ml: 3 }}>
                <Controller
                  control={control}
                  name={`filler.${idx}.fillerOrder`}
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
                        {helperText && (
                          <FormHelperText>{helperText}</FormHelperText>
                        )}
                      </FormControl>
                    );
                  }}
                />
              </Stack>
            </Grid>
          </Grid>
          {idx < fillerFields.fields.length - 1 && <Divider />}
        </>
      ))}
    </Stack>
  );
};
