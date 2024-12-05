import { Delete } from '@mui/icons-material';
import {
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  Tooltip,
} from '@mui/material';
import {
  RandomSlot,
  RandomSlotProgramming,
  RedirectProgrammingRandomSlot,
} from '@tunarr/types/api';
import { map, range } from 'lodash-es';
import React, { useCallback } from 'react';
import { Control, UseFormSetValue, useWatch } from 'react-hook-form';
import {
  DropdownOption,
  ProgramOption,
  RedirectProgramOption,
} from '../../helpers/slotSchedulerUtil';
import { handleNumericFormValue } from '../../helpers/util';
import { RandomSlotForm } from '../../pages/channels/RandomSlotEditorPage';

const slotDurationOptions: DropdownOption<number>[] = map(
  [
    ...map(range(5, 50, 5), (n) => ({ value: n, description: `${n} minutes` })),
    { value: 60, description: '1 hour' },
    { value: 90, description: '90 minutes' },
    { value: 100, description: '100 minutes' },
    ...map(range(2, 6), (n) => ({ value: n * 60, description: `${n} hours` })),
    ...map(range(6, 13, 2), (n) => ({
      value: n * 60,
      description: `${n} hours`,
    })),
    { value: 24 * 60, description: '1 day' },
  ],
  (opt) => ({ ...opt, value: opt.value * 60 * 1000 }),
);

const slotCooldownOptions: DropdownOption<number>[] = map(
  [
    { value: 0, description: 'No cooldown' },
    ...map(range(5, 60, 5), (n) => ({ value: n, description: `${n} minutes` })),
  ],
  (opt) => ({ ...opt, value: opt.value * 60 * 1000 }),
);

const slotOrderOptions: DropdownOption<string>[] = [
  { value: 'shuffle', description: 'Shuffle' },
  { value: 'next', description: 'Play Next' },
];

type RandomSlotRowProps = {
  index: number;
  control: Control<RandomSlotForm>;
  setValue: UseFormSetValue<RandomSlotForm>;
  programOptions: ProgramOption[];
  removeSlot: (idx: number) => void;
};

export const RandomSlotRow = React.memo(
  ({
    index,
    control,
    setValue,
    programOptions,
    removeSlot,
  }: RandomSlotRowProps) => {
    const slot = useWatch({ control, name: `slots.${index}` });
    const updateSlotType = useCallback(
      (idx: number, slotId: string) => {
        let slotProgram: RandomSlotProgramming;

        if (slotId.startsWith('show')) {
          slotProgram = {
            type: 'show',
            showId: slotId.split('.')[1],
          };
        } else if (slotId.startsWith('movie')) {
          slotProgram = {
            type: 'movie',
          };
        } else if (slotId.startsWith('flex')) {
          slotProgram = {
            type: 'flex',
          };
        } else if (slotId.startsWith('redirect')) {
          const channelId = slotId.split('.')[1];
          slotProgram = {
            type: 'redirect',
            channelId,
            channelName: programOptions.find(
              (opt): opt is RedirectProgramOption =>
                opt.type === 'redirect' && opt.channelId === channelId,
            )?.channelName,
          } satisfies RedirectProgrammingRandomSlot;
        } else if (slotId.startsWith('custom-show')) {
          slotProgram = {
            type: 'custom-show',
            customShowId: slotId.split('.')[1],
          };
        } else {
          return;
        }

        const newSlot: RandomSlot = {
          ...slot,
          order: 'next', // Default
          programming: slotProgram,
        };

        setValue(`slots.${idx}`, { ...newSlot }, { shouldDirty: true });
      },
      [setValue, slot],
    );

    const updateSlot = useCallback(
      (idx: number, newSlot: Partial<RandomSlot>) => {
        setValue(
          `slots.${idx}`,
          { ...slot, ...newSlot },
          { shouldDirty: true },
        );
      },
      [setValue, slot],
    );

    let selectValue: string;
    switch (slot.programming.type) {
      case 'show': {
        selectValue = `show.${slot.programming.showId}`;
        break;
      }
      case 'redirect': {
        selectValue = `redirect.${slot.programming.channelId}`;
        break;
      }
      case 'custom-show':
        selectValue = `custom-show.${slot.programming.customShowId}`;
        break;
      default: {
        selectValue = slot.programming.type;
        break;
      }
    }

    return (
      <>
        <Grid item xs={2}>
          <Select
            fullWidth
            value={slot.durationMs}
            onChange={(e) =>
              updateSlot(index, {
                durationMs: handleNumericFormValue(e.target.value),
              })
            }
            MenuProps={{ sx: { maxHeight: 400 } }}
          >
            {map(slotDurationOptions, (opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.description}
              </MenuItem>
            ))}
          </Select>
        </Grid>
        <Grid item xs={5}>
          <FormControl fullWidth>
            <InputLabel>Program</InputLabel>
            <Select
              label="Program"
              value={selectValue}
              onChange={(e) => updateSlotType(index, e.target.value)}
            >
              {map(programOptions, ({ description, value }) => (
                <MenuItem key={value} value={value}>
                  {description}
                </MenuItem>
              ))}
            </Select>
          </FormControl>
        </Grid>
        <Grid item xs={2}>
          <Select
            fullWidth
            value={slot.cooldownMs}
            onChange={(e) =>
              updateSlot(index, {
                cooldownMs: handleNumericFormValue(e.target.value),
              })
            }
          >
            {map(slotCooldownOptions, (opt) => (
              <MenuItem key={opt.value} value={opt.value}>
                {opt.description}
              </MenuItem>
            ))}
          </Select>
        </Grid>
        <Grid item xs={2}>
          {slot.programming.type === 'show' ||
          slot.programming.type === 'custom-show' ? (
            <Select<'next' | 'shuffle'>
              fullWidth
              value={slot.order ?? 'next'}
              onChange={(e) =>
                updateSlot(index, {
                  order: (e.target.value ?? 'next') as 'next' | 'shuffle',
                })
              }
            >
              {map(slotOrderOptions, (opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
          ) : (
            <Tooltip title="This applies to shows only">
              <Select fullWidth value="N/A" disabled={true}>
                <MenuItem key={'N/A'} value={'N/A'}>
                  {'N/A'}
                </MenuItem>
              </Select>
            </Tooltip>
          )}
        </Grid>
        <Grid item xs={1}>
          <IconButton onClick={() => removeSlot(index)} color="error">
            <Delete />
          </IconButton>
        </Grid>
      </>
    );
  },
);
