import { Trans, useLingui } from '@lingui/react/macro';
import {
  Add,
  Delete,
  FirstPage,
  LastPage,
  LowPriority,
  Repeat,
  VerticalAlignCenter,
} from '@mui/icons-material';
import {
  Autocomplete,
  Button,
  Divider,
  FormControl,
  FormHelperText,
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
import { slotHasFiller } from '@tunarr/types/api';
import { find, map, some } from 'lodash-es';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Controller, useFieldArray, useFormContext } from 'react-hook-form';
import { slotOrderOptions } from '../../helpers/slotSchedulerUtil.ts';
import { useFillerLists } from '../../hooks/useFillerLists.ts';

export const SlotFillerDialogPanel = () => {
  const { t } = useLingui();
  const { control, getValues, watch } = useFormContext<BaseSlot>();
  const fillerFields = useFieldArray({ control, name: 'filler' });
  const { data: fillerLists } = useFillerLists();

  // Seed from the form so the already-chosen lists are known before the
  // watcher below fires for the first time.
  const [chosenFillerLists, setChosenFillerLists] = useState<string[]>(() => {
    const slot = getValues();
    return slotHasFiller(slot)
      ? seq.collect(slot.filler, (filler) => filler?.fillerListId)
      : [];
  });

  // Insanely stupid hack we have to do in order to re-render on nested value
  // set.
  useEffect(() => {
    const { unsubscribe } = watch((value, info) => {
      if (
        value.type &&
        (value.type === 'movie' ||
          value.type === 'custom-show' ||
          value.type === 'show' ||
          value.type === 'smart-collection') &&
        info.name?.startsWith('filler')
      ) {
        const fillerListIds = seq.collect(
          value.filler,
          (filler) => filler?.fillerListId,
        );
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

  // An empty filler list would never contribute anything to the slot, so it
  // isn't a candidate for a new row.
  const nextAddableFillerList = useMemo(
    () =>
      fillerLists.find(
        (list) =>
          list.contentCount > 0 &&
          !some(chosenFillerLists, (field) => field === list.id),
      ),
    [fillerLists, chosenFillerLists],
  );

  const handleAddNewFillerList = useCallback(() => {
    if (!nextAddableFillerList) {
      return;
    }

    fillerFields.append({
      types: ['pre'],
      fillerListId: nextAddableFillerList.id,
      fillerOrder: 'shuffle_prefer_short',
    });
  }, [fillerFields, nextAddableFillerList]);

  if (fillerLists.length === 0) {
    return null;
  }

  return (
    <Stack spacing={2}>
      <Button
        startIcon={<Add />}
        variant="outlined"
        disabled={!nextAddableFillerList}
        onClick={handleAddNewFillerList}
      >
        <Trans>Add filler</Trans>
      </Button>
      {fillerFields.fields.map((fillerField, idx) => (
        <>
          <Stack spacing={2}>
            <Stack spacing={2} direction={'row'}>
              <IconButton
                onClick={() => fillerFields.remove(idx)}
                disableRipple
                sx={{ alignSelf: 'start', top: 2 }}
              >
                <Delete />{' '}
              </IconButton>
              <Controller
                control={control}
                name={`filler.${idx}.fillerListId` as const}
                rules={{ required: true }}
                render={({ field }) => {
                  const selected = find(fillerLists, { id: field.value });
                  return (
                    <Autocomplete
                      fullWidth
                      disableClearable={true}
                      options={fillerListOptions}
                      getOptionKey={(list) => list.id}
                      getOptionLabel={(list) => list.name}
                      // An empty filler list can't contribute anything to the
                      // slot, so don't let one be picked.
                      getOptionDisabled={(list) => list.contentCount === 0}
                      value={selected}
                      onChange={(_, list) => field.onChange(list?.id)}
                      renderInput={(params) => (
                        <TextField
                          {...params}
                          fullWidth
                          label={t`Filler List`}
                          helperText={
                            selected && selected.contentCount === 0
                              ? t`This filler list has no programs and will be ignored.`
                              : ' '
                          }
                        />
                      )}
                    />
                  );
                }}
              />
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
            <Stack direction={'row'} sx={{ pl: 6 }}>
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
                      <Trans>Head</Trans>
                    </ToggleButton>
                    <ToggleButton value={'pre'}>
                      <LowPriority
                        sx={{
                          rotate: '180deg',
                          transform: 'scale(-1, 1)',
                          mr: 1,
                        }}
                      />{' '}
                      <Trans>Pre</Trans>
                    </ToggleButton>
                    <ToggleButton value="mid">
                      <VerticalAlignCenter sx={{ mr: 1 }} /> <Trans>Mid</Trans>
                    </ToggleButton>
                    <ToggleButton value="post">
                      <LowPriority sx={{ mr: 1 }} /> <Trans>Post</Trans>
                    </ToggleButton>
                    <ToggleButton value="tail">
                      <LastPage sx={{ mr: 1 }} /> <Trans>Tail</Trans>
                    </ToggleButton>
                    <ToggleButton value="fallback">
                      <Repeat /> <Trans>Fallback</Trans>
                    </ToggleButton>
                  </ToggleButtonGroup>
                )}
              />
            </Stack>
          </Stack>
          {idx < fillerFields.fields.length - 1 && <Divider />}
        </>
      ))}
    </Stack>
  );
};
