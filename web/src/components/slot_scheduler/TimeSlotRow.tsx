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
import { map, reject } from 'lodash-es';
import { Fragment, useCallback } from 'react';
import {
  Control,
  Controller,
  UseFormSetValue,
  useWatch,
} from 'react-hook-form';
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
  slot: TimeSlot;
  index: number;
  control: Control<TimeSlotForm>;
  setValue: UseFormSetValue<TimeSlotForm>;
  programOptions: ProgramOption[];
};

export const TimeSlotRow = ({
  slot,
  index,
  control,
  setValue,
  programOptions,
}: TimeSlotProps) => {
  const start = dayjs.tz().startOf('day');
  const currentSlots = useWatch({ control, name: 'slots' });
  const currentPeriod = useWatch({ control, name: 'period' });

  const updateSlotTime = useCallback(
    (idx: number, time: dayjs.Dayjs) => {
      setValue(
        `slots.${idx}.startTime`,
        time
          .mod(dayjs.duration(1, 'day'))
          .subtract({ minutes: new Date().getTimezoneOffset() })
          .asMilliseconds(),
        { shouldDirty: true },
      );
    },
    [setValue],
  );

  const removeSlot = useCallback(
    (idx: number) => {
      setValue(
        'slots',
        reject(currentSlots, (_, i) => idx === i),
        { shouldDirty: true },
      );
    },
    [currentSlots, setValue],
  );

  const updateSlotDay = useCallback(
    (idx: number, currentDay: number, dayOfWeek: number) => {
      const slot = currentSlots[idx];
      const daylessStartTime = slot.startTime - currentDay * OneDayMillis;
      const newStartTime = daylessStartTime + dayOfWeek * OneDayMillis;
      setValue(`slots.${idx}.startTime`, newStartTime, { shouldDirty: true });
    },
    [currentSlots, setValue],
  );

  const updateSlotType = useCallback(
    (idx: number, slotId: string) => {
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

      setValue(
        `slots.${idx}`,
        { ...slot, startTime: curr.startTime },
        { shouldDirty: true },
      );
    },
    [currentSlots, setValue],
  );

  const startTime = start.add(slot.startTime);
  // .subtract(new Date().getTimezoneOffset(), 'minutes');
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
    case 'custom-show': {
      selectValue = `${slot.programming.type}.${slot.programming.customShowId}`;
      break;
    }
    default: {
      selectValue = slot.programming.type;
      break;
    }
  }

  const isShowType = slot.programming.type === 'show';
  let showInputSize = currentPeriod === 'week' ? 7 : 9;
  if (isShowType) {
    showInputSize -= 3;
  }

  const dayOfTheWeek = Math.floor(slot.startTime / OneDayMillis);

  return (
    <Fragment key={`${slot.startTime}_${index}`}>
      {currentPeriod === 'week' ? (
        <Grid item xs={2}>
          <Select
            fullWidth
            value={dayOfTheWeek}
            onChange={(e) =>
              updateSlotDay(index, dayOfTheWeek, e.target.value as number)
            }
          >
            {map(DaysOfWeekMenuItems, ({ value, name }) => (
              <MenuItem key={value} value={value}>
                {name}
              </MenuItem>
            ))}
          </Select>
        </Grid>
      ) : null}
      <Grid item xs={2}>
        <TimePicker
          onChange={(value) => value && updateSlotTime(index, value)}
          value={startTime}
          label="Start Time"
        />
      </Grid>
      <Grid item xs={showInputSize}>
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
        <IconButton onClick={() => removeSlot(index)} color="error">
          <Delete />
        </IconButton>
      </Grid>
    </Fragment>
  );
};
