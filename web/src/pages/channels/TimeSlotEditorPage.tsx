import { ClearSlotsButton } from '@/components/slot_scheduler/ClearSlotsButton.tsx';
import { MissingProgramsAlert } from '@/components/slot_scheduler/MissingProgramsAlert.tsx';
import { lineupItemAppearsInSchedule } from '@/helpers/slotSchedulerUtil.ts';
import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions.ts';
import { useChannelEditorLazy } from '@/store/selectors.ts';
import { ArrowBack, Autorenew } from '@mui/icons-material';
import {
  Alert,
  Box,
  Button,
  Divider,
  FormControl,
  FormGroup,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  SelectChangeEvent,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers/DateTimePicker';
import { Link as RouterLink } from '@tanstack/react-router';
import { dayjsMod, scheduleTimeSlots } from '@tunarr/shared';
import { TimeSlot, TimeSlotSchedule } from '@tunarr/types/api';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import { chain, filter, first, isUndefined, map, range } from 'lodash-es';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { AddTimeSlotButton } from '../../components/slot_scheduler/AddTimeSlotButton.tsx';
import { TimeSlotRow } from '../../components/slot_scheduler/TimeSlotRow.tsx';
import { NumericFormControllerText } from '../../components/util/TypedController.tsx';
import {
  DropdownOption,
  flexOptions,
  padOptions,
} from '../../helpers/slotSchedulerUtil.ts';
import { zipWithIndex } from '../../helpers/util.ts';
import { useUpdateLineup } from '../../hooks/useUpdateLineup.ts';
import {
  resetLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions.ts';
import { UIChannelProgram } from '../../types/index.ts';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(dayjsMod);

export const OneDayMillis = dayjs.duration(1, 'day').asMilliseconds();

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

export type TimeSlotForm = Omit<TimeSlotSchedule, 'timeZoneOffset' | 'type'>;

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
  maxDays: 365,
  padMs: 1,
  slots: [],
  period: 'day',
  timeZoneOffset: new Date().getTimezoneOffset(),
};

export default function TimeSlotEditorPage() {
  // Requires that the channel was already loaded... not the case if
  // we navigated directly, so we need to handle that
  const {
    channelEditor: {
      currentEntity: channel,
      // programList: newLineup,
      schedule: loadedSchedule,
    },
    getMaterializedProgramList,
  } = useChannelEditorLazy();

  const [startTime, setStartTime] = useState(
    channel?.startTime ? dayjs(channel?.startTime) : dayjs(),
  );

  const snackbar = useSnackbar();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const programOptions = useSlotProgramOptions();

  const {
    control,
    getValues,
    setValue,
    watch,
    formState: { isValid, isDirty, errors },
    reset,
  } = useForm<TimeSlotForm>({
    defaultValues:
      !isUndefined(loadedSchedule) && loadedSchedule.type === 'time'
        ? loadedSchedule
        : defaultTimeSlotSchedule,
    mode: 'all',
  });

  /* Uncomment when we can make this work better and be more performant....
  useEffect(() => {
    const sub = watch(({ slots }, { name }) => {
      if (name?.startsWith('slots') && slots) {
        const grouped = groupBy(slots, 'startTime');
        const isError = some(values(grouped), (group) => group.length > 1);
        if (isError) {
          const badIndexes = seq.collect(slots, (slot, index) => {
            if (
              !isUndefined(slot?.startTime) &&
              grouped[slot.startTime]?.length > 1
            ) {
              return index;
            }
          });

          setError('slots', {
            message: 'All slot start times must be unique',
            type: 'unique',
          });

          badIndexes.forEach((index) => {
            setError(`slots.${index}.startTime`, {
              message: 'All slot start times must be unique',
              type: 'unique',
            });
          });
          hadSlotError(true)
        } else if (hadSlotError) {
          const keys = range(0, slots.length).map(
            (i) => `slots.${i}.startTime` as const,
          );
          clearErrors(['slots', ...keys]);
          setHadSlotError(false)
        }
      }
    });
    return () => {
      sub.unsubscribe();
    };
  }, [setError, watch, clearErrors]);
  */

  const slotArray = useFieldArray({
    control,
    name: 'slots',
    rules: {
      required: true,
    },
  });

  const updateLineupMutation = useUpdateLineup({
    onSuccess(data) {
      reset(data.schedule ?? defaultTimeSlotSchedule, {
        keepDefaultValues: false,
        keepDirty: false,
      });
    },
  });

  // Have to use a watch here because rendering depends on this value
  const currentPeriod = watch('period');

  const [generatedList, setGeneratedList] = useState<
    UIChannelProgram[] | undefined
  >(undefined);

  const resetLineupToSaved = useCallback(() => {
    setGeneratedList(undefined);
    resetLineup();
    reset();
  }, [reset]);

  const onSave = () => {
    const schedule: TimeSlotSchedule = {
      ...getValues(),
      timeZoneOffset: new Date().getTimezoneOffset(),
      type: 'time',
    };

    // Find programs that have active slots
    const filteredLineup = filter(getMaterializedProgramList(), (item) =>
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
      const currentSlots = getValues('slots');
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
      slotArray.replace(newSlots);
    },
    [setValue, getValues, slotArray],
  );

  const renderTimeSlots = () => {
    const slots = map(slotArray.fields, (slot, idx) => {
      return (
        <TimeSlotRow
          key={slot.id}
          control={control}
          index={idx}
          programOptions={programOptions}
          removeSlot={() => slotArray.remove(idx)}
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
      getMaterializedProgramList(),
    )
      .then((res) => {
        performance.mark('guide-end');
        const { duration: ms } = performance.measure(
          'guide',
          'guide-start',
          'guide-end',
        );
        showPerfSnackbar(Math.round(ms), res.programs.length);
        setStartTime(dayjs(res.startTime));
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
      <Stack gap={2} useFlexGap>
        <Typography variant="h4">{channel.name}</Typography>
        <MissingProgramsAlert control={control} />
        {errors.slots?.message && (
          <Alert severity="error">{errors.slots.message}</Alert>
        )}
        <PaddedPaper>
          <Stack direction="row" alignItems="center">
            <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>
              Time Slots
            </Typography>
            <ClearSlotsButton
              fields={slotArray.fields}
              remove={slotArray.remove}
            />
            <AddTimeSlotButton
              slots={slotArray.fields}
              append={slotArray.append}
            />
          </Stack>
          <Divider sx={{ my: 2 }} />
          {renderTimeSlots()}
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
                    Maximum number of days to precalculate the schedule. Note
                    that the length of the schedule is also bounded by the
                    maximum number of programs allowed in a channel.
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
          <Typography sx={{ mb: 1 }}>Programming Preview</Typography>
          <Divider sx={{ mb: 1 }} />
          <DateTimePicker
            label="Programming Start"
            value={startTime}
            disabled
            slotProps={{ textField: { size: 'small' } }}
          />
          {generatedList ? (
            <ChannelProgrammingList
              type={'direct'}
              programList={zipWithIndex(generatedList)}
              enableDnd={false}
              enableRowDelete={false}
              enableRowEdit={false}
              virtualListProps={{
                width: '100%',
                height: 400,
                itemSize: smallViewport ? 70 : 35,
                overscanCount: 5,
              }}
            />
          ) : (
            <ChannelProgrammingList
              type="selector"
              enableDnd={false}
              enableRowDelete={false}
              enableRowEdit={false}
              virtualListProps={{
                width: '100%',
                height: 400,
                itemSize: smallViewport ? 70 : 35,
                overscanCount: 5,
              }}
            />
          )}
        </PaddedPaper>
      </Stack>
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
