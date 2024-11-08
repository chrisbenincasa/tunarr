import { Delete } from '@mui/icons-material';
import {
  FormControl,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { TimeSlot, TimeSlotProgramming } from '@tunarr/types/api';
import dayjs from 'dayjs';
import { isNil, map, uniqBy } from 'lodash-es';
import { Fragment, useCallback } from 'react';
import { Control, Controller, useWatch } from 'react-hook-form';
import { ProgramOption } from '../../helpers/slotSchedulerUtil.ts';
import {
  OneDayMillis,
  TimeSlotForm,
} from '../../pages/channels/TimeSlotEditorPage.tsx';

const DaysOfWeekMenuItems = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' },
];

const showOrderOptions = [
  {
    value: 'next',
    description: 'Next Episode',
  },
  {
    value: 'shuffle',
    description: 'Shuffle',
  },
];

type TimeSlotProps = {
  index: number;
  control: Control<TimeSlotForm>;
  removeSlot: () => void;
  programOptions: ProgramOption[];
};

export const TimeSlotRow = ({
  index,
  control,
  removeSlot,
  programOptions,
}: TimeSlotProps) => {
  const currentSlots = useWatch({ control, name: 'slots' });
  const slot = currentSlots[index];
  const currentPeriod = useWatch({ control, name: 'period' });

  const updateSlotDay = useCallback(
    (
      currentDay: number,
      dayOfWeek: number,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      const slot = currentSlots[index];
      const daylessStartTime = slot.startTime - currentDay * OneDayMillis;
      const newStartTime = daylessStartTime + dayOfWeek * OneDayMillis;
      originalOnChange(newStartTime);
    },
    [currentSlots, index],
  );

  const updateSlotType = useCallback(
    (
      idx: number,
      slotId: string,
      originalOnChange: (...args: unknown[]) => void,
    ) => {
      let slotProgram: TimeSlotProgramming;

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
        slotProgram = {
          type: 'redirect',
          channelId: slotId.split('.')[1],
        };
      } else if (slotId.startsWith('custom-show')) {
        slotProgram = {
          type: 'custom-show',
          customShowId: slotId.split('.')[1],
        };
      } else {
        return;
      }

      const slot: Omit<TimeSlot, 'startTime'> = {
        order: 'next',
        programming: slotProgram,
      };

      const curr = currentSlots[idx];
      originalOnChange({ ...slot, startTime: curr.startTime });
    },
    [currentSlots],
  );

  const getProgramDropdownValue = (programming: TimeSlotProgramming) => {
    switch (programming.type) {
      case 'show': {
        return `show.${programming.showId}`;
      }
      case 'redirect': {
        return `redirect.${programming.channelId}`;
      }
      case 'custom-show': {
        return `${programming.type}.${programming.customShowId}`;
      }
      default: {
        return programming.type;
      }
    }
  };

  const isShowType = slot.programming.type === 'show';
  let showInputSize = currentPeriod === 'week' ? 7 : 9;
  if (isShowType) {
    showInputSize -= 3;
  }

  const dayOfTheWeek = Math.floor(slot.startTime / OneDayMillis);

  return (
    <Fragment>
      {currentPeriod === 'week' ? (
        <Grid item xs={2}>
          <Controller
            control={control}
            name={`slots.${index}.startTime`}
            rules={{
              validate: {
                unique: (_, { slots }) => {
                  if (uniqBy(slots, 'startTime').length !== slots.length) {
                    return 'BAD';
                  }
                },
              },
            }}
            render={({ field }) => (
              <Select
                fullWidth
                {...field}
                value={dayOfTheWeek}
                onChange={(e) =>
                  updateSlotDay(
                    dayOfTheWeek,
                    e.target.value as number,
                    field.onChange,
                  )
                }
              >
                {map(DaysOfWeekMenuItems, ({ value, name }) => (
                  <MenuItem key={value} value={value}>
                    {name}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </Grid>
      ) : null}
      <Grid item xs={2}>
        <Controller
          control={control}
          name={`slots.${index}.startTime`}
          render={({ field, fieldState: { error } }) => (
            <TimePicker
              {...field}
              // TODO: Jank fest
              value={dayjs(field.value).add(
                new Date().getTimezoneOffset(),
                'minutes',
              )}
              onChange={(value) => {
                value
                  ? field.onChange(
                      value
                        .mod(dayjs.duration(1, currentPeriod))
                        .subtract({ minutes: new Date().getTimezoneOffset() })
                        .asMilliseconds(),
                    )
                  : void 0;
              }}
              label="Start Time"
              closeOnSelect={false}
              slotProps={{
                textField: {
                  error: !isNil(error),
                },
              }}
            />
          )}
        />
      </Grid>
      <Grid item xs={showInputSize}>
        <FormControl fullWidth>
          <InputLabel>Program</InputLabel>
          <Controller
            control={control}
            name={`slots.${index}`}
            render={({ field }) => (
              <Select
                label="Program"
                {...field}
                value={getProgramDropdownValue(field.value.programming)}
                onChange={(e) =>
                  updateSlotType(index, e.target.value, field.onChange)
                }
              >
                {map(programOptions, ({ description, value }) => (
                  <MenuItem key={value} value={value}>
                    {description}
                  </MenuItem>
                ))}
              </Select>
            )}
          />
        </FormControl>
      </Grid>
      {isShowType && (
        <Grid item xs={3}>
          <FormControl fullWidth>
            <InputLabel>Order</InputLabel>
            <Controller
              control={control}
              name={`slots.${index}.order`}
              render={({ field }) => (
                <Select label="Order" {...field}>
                  {map(showOrderOptions, ({ description, value }) => (
                    <MenuItem key={value} value={value}>
                      {description}
                    </MenuItem>
                  ))}
                </Select>
              )}
            />
          </FormControl>
        </Grid>
      )}
      <Grid item xs={1}>
        <IconButton onClick={removeSlot} color="error">
          <Delete />
        </IconButton>
      </Grid>
    </Fragment>
  );
};
