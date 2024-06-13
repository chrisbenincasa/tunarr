import { ArrowBack, Autorenew, Delete } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormGroup,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { dayjsMod, scheduleTimeSlots } from '@tunarr/shared';
import { ChannelProgram, isContentProgram } from '@tunarr/types';
import {
  TimeSlot,
  TimeSlotProgramming,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import {
  chain,
  filter,
  first,
  isUndefined,
  map,
  maxBy,
  range,
  reject,
  some,
} from 'lodash-es';
import { Fragment, useCallback, useMemo, useState } from 'react';
import {
  Control,
  Controller,
  UseFormSetValue,
  useForm,
  useWatch,
} from 'react-hook-form';
import { Link as RouterLink } from '@tanstack/react-router';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import {
  DropdownOption,
  ProgramOption,
  flexOptions,
  padOptions,
} from '../../components/slot_scheduler/commonSlotSchedulerOptions.ts';
import { NumericFormControllerText } from '../../components/util/TypedController.tsx';
import { zipWithIndex } from '../../helpers/util.ts';
import { useUpdateLineup } from '../../hooks/useUpdateLineup.ts';
import {
  resetLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import { UIChannelProgram, isUIRedirectProgram } from '../../types/index.ts';
import { useChannelEditor } from '@/store/selectors.ts';
import pluralize from 'pluralize';
import { useSnackbar } from 'notistack';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(dayjsMod);

const OneDayMillis = dayjs.duration(1, 'day').asMilliseconds();

// TODO Make this locale aware
const DaysOfWeekMenuItems = [
  { value: 0, name: 'Sunday' },
  { value: 1, name: 'Monday' },
  { value: 2, name: 'Tuesday' },
  { value: 3, name: 'Wednesday' },
  { value: 4, name: 'Thursday' },
  { value: 5, name: 'Friday' },
  { value: 6, name: 'Saturday' },
];

// mutates array
function rotateArrayRight<T>(arr: T[], times: number): T[] {
  if (times <= 0) {
    return arr;
  }

  if (arr.length === 0) {
    return arr;
  }

  let i = 0;
  while (i < times) {
    arr.push(arr.shift()!);
    i++;
  }

  return arr;
}

type TimeSlotForm = Omit<TimeSlotSchedule, 'timeZoneOffset' | 'type'>;

const latenessOptions: DropdownOption<number>[] = [
  dayjs.duration(5, 'minutes'),
  dayjs.duration(10, 'minutes'),
  dayjs.duration(15, 'minutes'),
  dayjs.duration(30, 'minutes'),
  dayjs.duration(1, 'hour'),
  dayjs.duration(2, 'hours'),
  dayjs.duration(4, 'hours'),
  dayjs.duration(8, 'hours'),
]
  .map((dur) => ({ value: dur.asMilliseconds(), description: dur.humanize() }))
  .concat([
    { value: 0, description: 'Do not allow' },
    {
      value: dayjs.duration(1, 'day').asMilliseconds(),
      description: 'Any amount',
    },
  ]);

const defaultTimeSlotSchedule: TimeSlotSchedule = {
  type: 'time',
  flexPreference: 'distribute',
  latenessMs: 0,
  maxDays: 10,
  padMs: 1,
  slots: [],
  period: 'day',
  timeZoneOffset: new Date().getTimezoneOffset(),
};

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

const lineupItemAppearsInSchedule = (
  slots: TimeSlot[],
  item: ChannelProgram,
) => {
  return some(slots, (slot) => {
    switch (slot.programming.type) {
      case 'redirect':
        return item.type === 'redirect';
      case 'flex':
        return item.type === 'flex';
      case 'movie':
        return (
          (item.type === 'content' && item.subtype === 'movie') ||
          (item.type === 'custom' && item.program?.subtype === 'movie')
        );
      case 'show': {
        const showTitle = slot.programming.showId;
        return (
          (item.type === 'content' &&
            item.subtype === 'episode' &&
            showTitle === item.title) ||
          (item.type === 'custom' &&
            item.program?.subtype === 'episode' &&
            item.program?.title === showTitle)
        );
      }
    }
  });
};

type AddTimeSlotButtonProps = {
  control: Control<TimeSlotForm>;
  setValue: UseFormSetValue<TimeSlotForm>;
};

const AddTimeSlotButton = ({ control, setValue }: AddTimeSlotButtonProps) => {
  const currentSlots = useWatch({ control, name: 'slots' });

  const addSlot = useCallback(() => {
    const maxSlot = maxBy(currentSlots, (p) => p.startTime);
    const newStartTime = maxSlot
      ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
      : dayjs.duration(new Date().getTimezoneOffset(), 'minutes');
    const newSlots: TimeSlot[] = [
      ...currentSlots,
      {
        programming: { type: 'flex' },
        startTime: newStartTime.asMilliseconds(),
        order: 'next',
      },
    ];

    setValue('slots', newSlots, { shouldDirty: true });
  }, [currentSlots, setValue]);

  return (
    <Button
      startIcon={<AddIcon />}
      variant="contained"
      onClick={() => addSlot()}
    >
      Add Slot
    </Button>
  );
};

type TimeSlotProps = {
  slot: TimeSlot;
  index: number;
  control: Control<TimeSlotForm>;
  setValue: UseFormSetValue<TimeSlotForm>;
  programOptions: ProgramOption[];
};

const TimeSlotRow = ({
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
        time.mod(dayjs.duration(1, 'day')).asMilliseconds(),
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

  const startTime = start
    .add(slot.startTime)
    .subtract(new Date().getTimezoneOffset(), 'minutes');
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

export default function TimeSlotEditorPage() {
  // Requires that the channel was already loaded... not the case if
  // we navigated directly, so we need to handle that
  const {
    currentEntity: channel,
    programList: newLineup,
    schedule: loadedSchedule,
  } = useChannelEditor();

  const [, setStartTime] = useState(
    channel?.startTime ?? dayjs().unix() * 1000,
  );

  const snackbar = useSnackbar();
  const updateLineupMutation = useUpdateLineup();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  // TODO: This can be shared between random / time slots
  const programOptions: ProgramOption[] = useMemo(() => {
    const contentPrograms = filter(newLineup, isContentProgram);
    const opts: ProgramOption[] = [{ value: 'flex', description: 'Flex' }];

    if (contentPrograms.length) {
      if (some(contentPrograms, (p) => p.subtype === 'movie')) {
        opts.push({ description: 'Movies', value: 'movie' });
      }

      const showOptions = chain(contentPrograms)
        .filter((p) => p.subtype === 'episode')
        .groupBy((p) => p.title)
        .reduce(
          (acc, _, title) => [
            ...acc,
            { description: title, value: `show.${title}` },
          ],
          [] as ProgramOption[],
        )
        .value();
      opts.push(...showOptions);
    }

    opts.push(
      ...chain(newLineup)
        .filter(isUIRedirectProgram)
        .uniqBy((p) => p.channel)
        .map((p) => ({
          description: `Redirect to "${p.channelName}"`,
          value: `redirect.${p.channel}`,
        }))
        .value(),
    );

    return opts;
  }, [newLineup]);

  const {
    control,
    getValues,
    setValue,
    watch,
    formState: { isValid, isDirty },
    reset,
  } = useForm<TimeSlotForm>({
    defaultValues:
      !isUndefined(loadedSchedule) && loadedSchedule.type === 'time'
        ? loadedSchedule
        : defaultTimeSlotSchedule,
  });

  // Have to use a watch here because rendering depends on this value
  const currentPeriod = watch('period');
  const currentSlots = watch('slots');

  const [generatedList, setGeneratedList] = useState<
    UIChannelProgram[] | undefined
  >(undefined);

  const resetLineupToSaved = useCallback(() => {
    setGeneratedList(undefined);
    resetLineup();
    reset();
  }, [setGeneratedList]);

  const onSave = () => {
    const schedule: TimeSlotSchedule = {
      ...getValues(),
      timeZoneOffset: new Date().getTimezoneOffset(),
      type: 'time',
    };

    // Find programs that have active slots
    const filteredLineup = filter(newLineup, (item) =>
      lineupItemAppearsInSchedule(getValues('slots'), item),
    );

    updateLineupMutation.mutate({
      channelId: channel!.id,
      lineupRequest: {
        type: 'time',
        schedule,
        programs: filteredLineup,
      },
    });
  };

  const handlePeriodChange = useCallback(
    (e: SelectChangeEvent<'day' | 'week' | 'month'>) => {
      const value = e.target.value as TimeSlotSchedule['period'];
      setValue('period', value, { shouldDirty: true });
      let newSlots: TimeSlot[] = [];
      if (value === 'day') {
        // Remove slots
        // This is (sort of) what the original behavior was... keep
        // as many unique time starts as possible. Seems weird. We
        // can change in the future if we want.
        newSlots = chain(currentSlots)
          .map((slot) => ({
            ...slot,
            startTime: dayjs(slot.startTime)
              .mod(dayjs.duration(1, 'day'))
              .asMilliseconds(),
          }))
          .groupBy((slot) => slot.startTime)
          .mapValues((v) => first(v)!)
          .values()
          .sortBy('startTime')
          .value();
      } else if (value === 'week') {
        const now = dayjs();
        const dayOfTheWeek = now.day();
        const offsets = rotateArrayRight(
          chain(range(0, 7))
            .map((i) => i * OneDayMillis)
            .value(),
          dayOfTheWeek,
        );

        // For each day offset, spread out the current slots for each day
        newSlots = chain(offsets)
          .map((offset) => {
            return map(currentSlots, (slot) => ({
              ...slot,
              startTime: slot.startTime + offset,
            }));
          })
          .flatten()
          .value();
      }

      // Add slots
      setValue('slots', newSlots, { shouldDirty: true });
    },
    [setValue, currentSlots],
  );

  const renderTimeSlots = () => {
    const slots = map(currentSlots, (slot, idx) => {
      return (
        <TimeSlotRow
          key={`${slot.startTime}_${idx}`}
          control={control}
          index={idx}
          programOptions={programOptions}
          setValue={setValue}
          slot={slot}
        />
      );
    });

    return (
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={currentPeriod === 'week' ? 4 : 2}>
          Start Time
        </Grid>
        <Grid item xs={currentPeriod === 'week' ? 8 : 10}>
          Program
        </Grid>
        {slots}
      </Grid>
    );
  };

  const showPerfSnackbar = (duration: number, numShows: number) => {
    const message = `Calculated ${dayjs
      .duration(getValues('maxDays'), 'days')
      .humanize()} (${numShows} ${pluralize(
      'program',
      numShows,
    )}) of programming in ${duration}ms`;
    snackbar.enqueueSnackbar(message, {
      variant: 'info',
    });
  };

  const calculateSlots = () => {
    performance.mark('guide-start');
    scheduleTimeSlots(
      {
        ...getValues(),
        timeZoneOffset: new Date().getTimezoneOffset(),
        type: 'time',
      },
      newLineup,
    )
      .then((res) => {
        performance.mark('guide-end');
        const { duration: ms } = performance.measure(
          'guide',
          'guide-start',
          'guide-end',
        );
        showPerfSnackbar(Math.round(ms), res.programs.length);
        // TODO Adjust for timezone
        setStartTime(res.startTime);
        updateCurrentChannel({ startTime: res.startTime });
        let offset = 0;
        const uiPrograms: UIChannelProgram[] = map(
          res.programs,
          (program, index) => {
            const newProgram = {
              ...program,
              originalIndex: index,
              startTimeOffset: offset,
            };
            offset += program.duration;
            return newProgram;
          },
        );
        setGeneratedList(uiPrograms);
      })
      .catch(console.error);
  };

  if (isUndefined(channel)) {
    return <div>Loading</div>;
  }

  return (
    <div>
      <Breadcrumbs />
      <Typography variant="h4" sx={{ mb: 2 }}>
        Edit Time Slots (Channel {channel?.number})
      </Typography>
      <PaddedPaper sx={{ mb: 2 }}>
        <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>
          Time Slots
        </Typography>
        <Divider sx={{ my: 2 }} />
        {renderTimeSlots()}
        <AddTimeSlotButton control={control} setValue={setValue} />
        <Divider sx={{ my: 2 }} />
        <Typography sx={{ flexGrow: 1, fontWeight: '600' }}>
          Settings
        </Typography>
        <Box>
          <Grid
            container
            spacing={2}
            columns={16}
            justifyContent={'flex-start'}
          >
            <Grid item sm={16} md={5}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Period</InputLabel>
                <Controller
                  control={control}
                  name="period"
                  render={({ field }) => (
                    <Select
                      label="Period"
                      {...field}
                      onChange={(e) => handlePeriodChange(e)}
                    >
                      <MenuItem value="day">Daily</MenuItem>
                      <MenuItem value="week">Weekly</MenuItem>
                    </Select>
                  )}
                />
                <FormHelperText>
                  By default, time slots are time of the day-based, you can
                  change it to time of the day + day of the week. That means
                  scheduling 7x the number of time slots. If you change from
                  daily to weekly, the current schedule will be repeated 7
                  times. If you change from weekly to daily, many of the slots
                  will be deleted.
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid item sm={16} md={5}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Max Lateness</InputLabel>
                <Controller
                  control={control}
                  name="latenessMs"
                  render={({ field }) => (
                    <Select label="Max Lateness" {...field}>
                      {latenessOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.description}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />

                <FormHelperText>
                  Allows programs to play a bit late if the previous program
                  took longer than usual. If a program is too late, Flex is
                  scheduled instead.
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid item sm={16} md={5}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Pad Times</InputLabel>
                <Controller
                  control={control}
                  name="padMs"
                  render={({ field }) => (
                    <Select label="Pad Times" {...field}>
                      {padOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.description}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />

                <FormHelperText>
                  Ensures programs have a nice-looking start time, it will add
                  Flex time to fill the gaps.
                </FormHelperText>
              </FormControl>
            </Grid>

            <Grid item sm={16} md={5}>
              <FormControl fullWidth margin="normal">
                <InputLabel>Flex Style</InputLabel>
                <Controller
                  control={control}
                  name="flexPreference"
                  render={({ field }) => (
                    <Select label="Flex Style" {...field}>
                      {flexOptions.map((opt) => (
                        <MenuItem key={opt.value} value={opt.value}>
                          {opt.description}
                        </MenuItem>
                      ))}
                    </Select>
                  )}
                />
                <FormHelperText>
                  Usually slots need to add flex time to ensure that the next
                  slot starts at the correct time. When there are multiple
                  videos in the slot, you might prefer to distribute the flex
                  time between the videos or to place most of the flex time at
                  the end of the slot.
                </FormHelperText>
              </FormControl>
            </Grid>
            <Grid item sm={16} md={5}>
              <FormGroup row>
                <NumericFormControllerText
                  control={control}
                  name="maxDays"
                  prettyFieldName="Days to Precalculate"
                  TextFieldProps={{
                    label: 'Days to Precalculate',
                    fullWidth: true,
                    margin: 'normal',
                  }}
                />

                <FormHelperText sx={{ ml: 1 }}>
                  Maximum number of days to precalculate the schedule. Note that
                  the length of the schedule is also bounded by the maximum
                  number of programs allowed in a channel.
                  <br />
                  <strong>
                    Note: Previewing the schedule in the browser for long
                    lengths of time can cause UI performance issues
                  </strong>
                </FormHelperText>
              </FormGroup>
            </Grid>
          </Grid>
        </Box>
        <Divider sx={{ my: 4 }} />
        <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
          <Button
            variant="contained"
            onClick={() => calculateSlots()}
            disabled={!isValid || !isDirty}
            startIcon={<Autorenew />}
          >
            Refresh Preview
          </Button>
        </Box>
      </PaddedPaper>
      <PaddedPaper>
        <Typography sx={{ pb: 1 }}>Programming Preview</Typography>
        <Divider />
        <ChannelProgrammingList
          programList={generatedList ? zipWithIndex(generatedList) : undefined}
          enableDnd={false}
          virtualListProps={{
            width: '100%',
            height: 400,
            itemSize: smallViewport ? 70 : 35,
            overscanCount: 5,
          }}
        />
      </PaddedPaper>
      <UnsavedNavigationAlert isDirty={isDirty} />
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Box flexGrow={1}>
          <Button
            variant="outlined"
            to=".."
            component={RouterLink}
            startIcon={<ArrowBack />}
            sx={{ justifyContent: 'flex-start' }}
          >
            Back to Programming
          </Button>
        </Box>
        {isDirty && (
          <Button variant="contained" onClick={() => resetLineupToSaved()}>
            Reset Options
          </Button>
        )}
        <Button
          variant="contained"
          disabled={!isValid || !isDirty}
          onClick={() => onSave()}
        >
          Save
        </Button>
      </Box>
    </div>
  );
}
