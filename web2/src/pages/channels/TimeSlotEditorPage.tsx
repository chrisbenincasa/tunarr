import { Delete } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
  Box,
  Breadcrumbs,
  Button,
  Divider,
  FormControl,
  FormGroup,
  FormHelperText,
  Grid,
  IconButton,
  InputLabel,
  Link,
  MenuItem,
  Select,
  SelectChangeEvent,
  Snackbar,
  TextField,
  Typography,
} from '@mui/material';
import { TimePicker } from '@mui/x-date-pickers/TimePicker';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { dayjsMod, scheduleTimeSlots } from '@tunarr/shared';
import { ChannelProgram, isContentProgram } from '@tunarr/types';
import {
  TimeSlot,
  TimeSlotProgramming,
  TimeSlotSchedule,
  UpdateChannelProgrammingRequest,
} from '@tunarr/types/api';
import { ZodiosError } from '@zodios/core';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import {
  chain,
  filter,
  first,
  isNull,
  isUndefined,
  map,
  maxBy,
  range,
  reject,
  some,
} from 'lodash-es';
import { Fragment, useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { Link as RouterLink } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList.tsx';
import { apiClient } from '../../external/api.ts';
import { zipWithIndex } from '../../helpers/util.ts';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';
import { updateCurrentChannel } from '../../store/channelEditor/actions.ts';
import { UIChannelProgram } from '../../types/index.ts';

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

type MutateArgs = {
  channelId: string;
  lineupRequest: UpdateChannelProgrammingRequest;
};

type DropdownOption<T extends string | number> = {
  value: T;
  description: string;
};
type ProgramOption = DropdownOption<string>;

const padOptions: DropdownOption<number>[] = [
  { value: 1, description: 'Do not pad' },
  { value: 5 * 60 * 1000, description: '0:00, 0:05, 0:10, ..., 0:55' },
  { value: 10 * 60 * 1000, description: '0:00, 0:10, 0:20, ..., 0:50' },
  { value: 15 * 60 * 1000, description: '0:00, 0:15, 0:30, ..., 0:45' },
  { value: 30 * 60 * 1000, description: '0:00, 0:30' },
  { value: 1 * 60 * 60 * 1000, description: '0:00' },
];

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

const flexOptions: DropdownOption<'end' | 'distribute'>[] = [
  { value: 'distribute', description: 'Between videos' },
  { value: 'end', description: 'End of the slot' },
];

const defaultTimeSlotSchedule: TimeSlotSchedule = {
  type: 'time',
  flexPreference: 'distribute',
  latenessMs: 0,
  maxDays: 10,
  padMs: 0,
  slots: [],
  period: 'day',
  timeZoneOffset: new Date().getTimezoneOffset(),
};

const lineupItemAppearsInSchedule = (
  slots: TimeSlot[],
  item: ChannelProgram,
) => {
  return some(slots, (slot) => {
    switch (slot.programming.type) {
      case 'flex':
        return item.type === 'flex' || item.type === 'redirect';
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

export default function TimeSlotEditorPage() {
  // Requires that the channel was already loaded... not the case if
  // we navigated directly, so we need to handle that
  const {
    currentEntity: channel,
    programList: newLineup,
    schedule: loadedSchedule,
  } = usePreloadedChannel();

  const [, setStartTime] = useState(
    channel?.startTime ?? dayjs().unix() * 1000,
  );

  const queryClient = useQueryClient();

  const updateLineupMutation = useMutation({
    mutationFn: ({ channelId, lineupRequest }: MutateArgs) => {
      return apiClient.post('/api/v2/channels/:id/programming', lineupRequest, {
        params: { id: channelId },
      });
    },
    onSuccess: async (_, { channelId }) => {
      await queryClient.invalidateQueries({
        queryKey: ['channels', channelId],
        exact: false,
      });
    },
    onError: (error) => {
      if (error instanceof ZodiosError) {
        console.error(error.message, error.data, error.cause);
      }
    },
  });

  const contentPrograms = filter(newLineup, isContentProgram);
  const programOptions: ProgramOption[] = [
    { value: 'flex', description: 'Flex' },
  ];

  if (contentPrograms.length) {
    if (some(contentPrograms, (p) => p.subtype === 'movie')) {
      programOptions.push({ description: 'Movies', value: 'movie' });
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
    programOptions.push(...showOptions);
  }

  const { control, getValues, setValue, watch } = useForm<
    Omit<TimeSlotSchedule, 'timeZoneOffset' | 'type'>
  >({
    defaultValues:
      !isUndefined(loadedSchedule) && loadedSchedule.type === 'time'
        ? loadedSchedule
        : defaultTimeSlotSchedule,
  });

  // Have to use a watch here because rendering depends on this value
  const currentPeriod = watch('period');
  const currentSlots = watch('slots');

  const schedule: TimeSlotSchedule = {
    ...getValues(),
    timeZoneOffset: new Date().getTimezoneOffset(),
    type: 'time',
  };

  const [perfSnackbarDetails, setPerfSnackbarDetails] = useState<{
    ms: number;
    numShows: number;
  } | null>(null);

  const [generatedList, setGeneratedList] = useState<
    UIChannelProgram[] | undefined
  >(undefined);

  const onSave = () => {
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
      setValue('period', value);
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
      setValue('slots', newSlots);
    },
    [setValue, currentSlots],
  );

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

    setValue('slots', newSlots);
  }, [currentSlots, setValue]);

  const updateSlotTime = useCallback(
    (idx: number, time: dayjs.Dayjs) => {
      setValue(
        `slots.${idx}.startTime`,
        time.mod(dayjs.duration(1, 'day')).asMilliseconds(),
      );
    },
    [setValue],
  );

  const updateSlotDay = useCallback(
    (idx: number, currentDay: number, dayOfWeek: number) => {
      const slot = currentSlots[idx];
      const daylessStartTime = slot.startTime - currentDay * OneDayMillis;
      const newStartTime = daylessStartTime + dayOfWeek * OneDayMillis;
      setValue(`slots.${idx}.startTime`, newStartTime);
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
        // TODO: Support redirect
      } else {
        return;
      }

      const slot: Omit<TimeSlot, 'startTime'> = {
        order: 'next',
        programming: slotProgram,
      };

      const curr = currentSlots[idx];

      setValue(`slots.${idx}`, { ...slot, startTime: curr.startTime });
    },
    [currentSlots, setValue],
  );

  const removeSlot = useCallback(
    (idx: number) => {
      setValue(
        'slots',
        reject(currentSlots, (_, i) => idx === i),
      );
    },
    [currentSlots, setValue],
  );

  const renderTimeSlots = () => {
    const start = dayjs.tz().startOf('day');

    const slots = map(currentSlots, (slot, idx) => {
      const startTime = start
        .add(slot.startTime)
        .subtract(new Date().getTimezoneOffset(), 'minutes');
      const selectValue =
        slot.programming.type === 'show'
          ? `show.${slot.programming.showId}`
          : slot.programming.type;
      const showInputSize = currentPeriod === 'week' ? 7 : 9;
      const dayOfTheWeek = Math.floor(slot.startTime / OneDayMillis);
      return (
        <Fragment key={`${slot.startTime}_${idx}`}>
          {currentPeriod === 'week' ? (
            <Grid item xs={2}>
              <Select
                fullWidth
                value={dayOfTheWeek}
                onChange={(e) =>
                  updateSlotDay(idx, dayOfTheWeek, e.target.value as number)
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
              onChange={(value) => value && updateSlotTime(idx, value)}
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
                onChange={(e) => updateSlotType(idx, e.target.value)}
              >
                {map(programOptions, ({ description, value }) => (
                  <MenuItem key={value} value={value}>
                    {description}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Grid>
          <Grid item xs={1}>
            <IconButton onClick={() => removeSlot(idx)} color="error">
              <Delete />
            </IconButton>
          </Grid>
        </Fragment>
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

  const calculateSlots = () => {
    performance.mark('guide-start');
    scheduleTimeSlots(schedule, newLineup)
      .then((res) => {
        performance.mark('guide-end');
        const { duration: ms } = performance.measure(
          'guide',
          'guide-start',
          'guide-end',
        );
        setPerfSnackbarDetails({
          ms: Math.round(ms),
          numShows: res.programs.length,
        });
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
      <Snackbar
        open={!isNull(perfSnackbarDetails)}
        autoHideDuration={5000}
        onClose={() => setPerfSnackbarDetails(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <Alert variant="filled" color="success">
          {perfSnackbarDetails
            ? `Calculated ${dayjs
                .duration(getValues('maxDays'), 'days')
                .humanize()} (${
                perfSnackbarDetails.numShows
              } programs) of programming in ${perfSnackbarDetails.ms}ms`
            : null}
        </Alert>
      </Snackbar>
      <Breadcrumbs sx={{ mb: 2 }}>
        <Link
          underline="hover"
          color="inherit"
          component={RouterLink}
          to=".."
          relative="path"
        >
          Back
        </Link>
      </Breadcrumbs>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Edit Time Slots (Channel {channel?.number})
      </Typography>
      <PaddedPaper sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignContent: 'center' }}>
          <Typography sx={{ flexGrow: 1 }}>Time Slots</Typography>
          <Button
            variant="contained"
            onClick={() => calculateSlots()}
            // disabled={!isValid}
          >
            Refresh
          </Button>
        </Box>
        <Divider sx={{ my: 2 }} />
        {renderTimeSlots()}
        <Button
          startIcon={<AddIcon />}
          variant="contained"
          onClick={() => addSlot()}
        >
          Add Slot
        </Button>
        <Divider sx={{ my: 2 }} />
        <Box>
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
              By default, time slots are time of the day-based, you can change
              it to time of the day + day of the week. That means scheduling 7x
              the number of time slots. If you change from daily to weekly, the
              current schedule will be repeated 7 times. If you change from
              weekly to daily, many of the slots will be deleted.
            </FormHelperText>
          </FormControl>
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
              Allows programs to play a bit late if the previous program took
              longer than usual. If a program is too late, Flex is scheduled
              instead.
            </FormHelperText>
          </FormControl>
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
              Ensures programs have a nice-looking start time, it will add Flex
              time to fill the gaps.
            </FormHelperText>
          </FormControl>
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
              Usually slots need to add flex time to ensure that the next slot
              starts at the correct time. When there are multiple videos in the
              slot, you might prefer to distribute the flex time between the
              videos or to place most of the flex time at the end of the slot.
            </FormHelperText>
          </FormControl>
          <FormGroup row>
            <Controller
              control={control}
              name="maxDays"
              render={({ field }) => (
                <TextField
                  fullWidth
                  margin="normal"
                  label="Days to Precalculate"
                  // error={!precalcDaysValid}
                  {...field}
                />
              )}
            />

            <FormHelperText sx={{ ml: 1 }}>
              Maximum number of days to precalculate the schedule. Note that the
              length of the schedule is also bounded by the maximum number of
              programs allowed in a channel.
            </FormHelperText>
          </FormGroup>
        </Box>
      </PaddedPaper>
      <PaddedPaper>
        <Typography sx={{ pb: 1 }}>
          Programming Preview (
          {generatedList
            ? `${generatedList.length} items, ${dayjs
                .duration(getValues('maxDays'), 'days')
                .humanize()}`
            : `${newLineup.length} items`}
          )
        </Typography>
        <Divider />
        <ChannelProgrammingList
          programList={generatedList ? zipWithIndex(generatedList) : undefined}
          enableDnd={false}
          virtualListProps={{
            width: '100%',
            height: 400,
            itemSize: 35,
            overscanCount: 5,
          }}
        />
      </PaddedPaper>
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Button
          variant="contained"
          to=".."
          relative="path"
          component={RouterLink}
        >
          Cancel
        </Button>
        <Button variant="contained" onClick={() => onSave()}>
          Save
        </Button>
      </Box>
    </div>
  );
}
