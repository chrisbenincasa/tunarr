import { RotatingLoopIcon } from '@/components/base/LoadingIcon.tsx';
import ChannelLineupList from '@/components/channel_config/ChannelLineupList.tsx';
import { TimeSlotFormProvider } from '@/components/slot_scheduler/TimeSlotFormProvider.tsx';
import { TimeSlotTable } from '@/components/slot_scheduler/TimeSlotTable.tsx';
import type { DropdownOption } from '@/helpers/DropdownOption.ts';
import {
  OneDayMillis,
  OneWeekMillis,
  lineupItemAppearsInSchedule,
} from '@/helpers/slotSchedulerUtil.ts';
import type {
  TimeSlotForm,
  TimeSlotViewModel,
} from '@/model/TimeSlotModels.ts';
import { useChannelEditorLazy } from '@/store/selectors.ts';
import { ArrowBack, Autorenew, ExpandMore } from '@mui/icons-material';
import type { SelectChangeEvent } from '@mui/material';
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  FormControl,
  FormGroup,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { DateTimePicker } from '@mui/x-date-pickers';
import { useQueryClient } from '@tanstack/react-query';
import { dayjsMod } from '@tunarr/shared';
import type {
  MaterializedTimeSlotSchedule,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import timezone from 'dayjs/plugin/timezone';
import utc from 'dayjs/plugin/utc';
import {
  filter,
  flatMap,
  groupBy,
  head,
  map,
  mapValues,
  range,
  sortBy,
  values,
} from 'lodash-es';
import { useCallback, useState } from 'react';
import { Controller, useFieldArray, useForm } from 'react-hook-form';
import Breadcrumbs from '../../components/Breadcrumbs.tsx';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import { RouterButtonLink } from '../../components/base/RouterButtonLink.tsx';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert.tsx';
import { SlotProgrammingOptionsProvider } from '../../components/slot_scheduler/SlotProgrammingOptionsProvider.tsx';
import { NumericFormControllerText } from '../../components/util/TypedController.tsx';
import { invalidateTaggedQueries } from '../../helpers/queryUtil.ts';
import { flexOptions, padOptions } from '../../helpers/slotSchedulerUtil.ts';
import { toggle } from '../../helpers/util.ts';
import { useScheduleSlots } from '../../hooks/slot_scheduler/useScheduleSlots.ts';
import { useChannelSchedule } from '../../hooks/useChannelSchedule.ts';
import { useUpdateLineup } from '../../hooks/useUpdateLineup.ts';
import { resetLineup } from '../../store/channelEditor/actions.ts';
import type { Maybe } from '../../types/util.ts';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(dayjsMod);

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

function convertToViewModel(
  schedule: MaterializedTimeSlotSchedule,
): TimeSlotForm {
  return {
    ...schedule,
    slots: map(schedule.slots, (slot) => ({
      ...slot,
      startTime:
        slot.startTime %
        (schedule.period === 'week' ? OneWeekMillis : OneDayMillis),
    })),
  };
}

export default function TimeSlotEditorPage() {
  const {
    channelEditor: { currentEntity: channel },
    materializeOriginalProgramList,
  } = useChannelEditorLazy();
  const { data: channelSchedule } = useChannelSchedule(channel!.id);

  const [startTime, setStartTime] = useState(
    channel?.startTime ? dayjs(channel?.startTime) : dayjs(),
  );
  const [randomState, setRandomState] =
    useState<Maybe<{ seed?: number[]; discardCount?: number }>>();

  const [settingsOpen, setSettingsOpen] = useState(true);

  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));

  const [isCalculatingSlots, toggleIsCalculatingSlots] = useToggle(false);

  const formMethods = useForm<TimeSlotForm>({
    defaultValues:
      channelSchedule.schedule?.type === 'time'
        ? convertToViewModel(channelSchedule.schedule)
        : defaultTimeSlotSchedule,
    // mode: 'all',
  });

  const {
    control,
    getValues,
    setValue,
    formState: { isDirty, errors },
    reset,
  } = formMethods;

  const slotArray = useFieldArray({
    control,
    name: 'slots',
    rules: {
      required: true,
    },
  });

  const queryClient = useQueryClient();
  const updateLineupMutation = useUpdateLineup({
    onSuccess() {
      queryClient
        .invalidateQueries({
          predicate: invalidateTaggedQueries('Channels'),
        })
        .catch(console.error);
    },
  });

  const resetLineupToSaved = useCallback(() => {
    resetLineup();
    reset();
  }, [reset]);

  const onSave = () => {
    const schedule = {
      ...getValues(),
      timeZoneOffset: new Date().getTimezoneOffset(),
      type: 'time',
    } satisfies TimeSlotSchedule;

    // Find programs that have active slots
    const filteredLineup = filter(materializeOriginalProgramList(), (item) =>
      lineupItemAppearsInSchedule(getValues('slots'), item),
    );

    updateLineupMutation.mutate({
      path: {
        id: channel!.id,
      },
      body: {
        type: 'time',
        schedule,
        programs: filteredLineup,
        seed: randomState?.seed,
        discardCount: randomState?.discardCount,
      },
    });
  };

  const handlePeriodChange = useCallback(
    (e: SelectChangeEvent<'day' | 'week' | 'month'>) => {
      const value = e.target.value as TimeSlotSchedule['period'];
      setValue('period', value, { shouldDirty: true });
      let newSlots: TimeSlotViewModel[] = [];
      const currentSlots = getValues('slots');
      if (value === 'day') {
        // Remove slots
        // This is (sort of) what the original behavior was... keep
        // as many unique time starts as possible. Seems weird. We
        // can change in the future if we want.
        const reducedSlots = values(
          mapValues(
            groupBy(
              currentSlots.map((slot) => ({
                ...slot,
                startTime: dayjs(slot.startTime)
                  .mod(dayjs.duration(1, 'day'))
                  .asMilliseconds(),
              })),
              (slot) => slot.startTime,
            ),
            (v) => head(v)!,
          ),
        );
        newSlots = sortBy(reducedSlots, 'startTime');
      } else if (value === 'week') {
        const offsets = map(range(0, 7), (i) => i * OneDayMillis);

        // For each day offset, spread out the current slots for each day
        newSlots = flatMap(offsets, (offset) => {
          return map(currentSlots, (slot) => ({
            ...slot,
            startTime: slot.startTime + offset,
          }));
        });
      }

      // Add slots
      slotArray.replace(newSlots);
    },
    [setValue, getValues, slotArray],
  );

  const { scheduleTimeSlots } = useScheduleSlots();

  const calculateSlots = () => {
    toggleIsCalculatingSlots(true);
    scheduleTimeSlots(getValues())
      .then(({ startTime, seed, discardCount }) => {
        setStartTime(dayjs(startTime));
        setRandomState({ seed, discardCount });
      })
      .catch((e) => {
        console.error(e);
      })
      .finally(() => {
        toggleIsCalculatingSlots(false);
      });
  };

  return (
    <div>
      <Breadcrumbs />
      <Stack gap={2} useFlexGap>
        <Typography variant="h4">{channel!.name}</Typography>
        {errors.slots?.message && (
          <Alert severity="error">{errors.slots.message}</Alert>
        )}
        <PaddedPaper>
          <Stack direction="row" alignItems="center">
            <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>
              Time Slots
            </Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <TimeSlotFormProvider {...formMethods} slotArray={slotArray}>
            <SlotProgrammingOptionsProvider>
              <TimeSlotTable />
            </SlotProgrammingOptionsProvider>
          </TimeSlotFormProvider>
          <Divider sx={{ my: 2 }} />
          <Stack direction="row">
            <Typography sx={{ flexGrow: 1, fontWeight: '600' }}>
              Settings
            </Typography>
            <ExpandMore
              sx={{ cursor: 'pointer' }}
              onClick={() => setSettingsOpen(toggle)}
            />
          </Stack>
          <Collapse in={settingsOpen}>
            <Box>
              <Grid
                container
                spacing={2}
                columns={16}
                justifyContent={'flex-start'}
              >
                <Grid size={{ sm: 16, md: 5 }}>
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
                      times. If you change from weekly to daily, many of the
                      slots will be deleted.
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid size={{ sm: 16, md: 5 }}>
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
                <Grid size={{ sm: 16, md: 5 }}>
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
                      Ensures programs have a nice-looking start time, it will
                      add Flex time to fill the gaps.
                    </FormHelperText>
                  </FormControl>
                </Grid>

                <Grid size={{ sm: 16, md: 5 }}>
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
                      Usually slots need to add flex time to ensure that the
                      next slot starts at the correct time. When there are
                      multiple videos in the slot, you might prefer to
                      distribute the flex time between the videos or to place
                      most of the flex time at the end of the slot.
                    </FormHelperText>
                  </FormControl>
                </Grid>
                <Grid size={{ sm: 16, md: 5 }}>
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
          </Collapse>
          <Divider sx={{ my: 4 }} />
          <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
            <Button
              variant="contained"
              onClick={() => calculateSlots()}
              disabled={isCalculatingSlots}
              startIcon={
                isCalculatingSlots ? <RotatingLoopIcon /> : <Autorenew />
              }
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
          <ChannelLineupList
            type="selector"
            enableDnd={false}
            enableRowDelete={false}
            enableRowEdit={false}
            virtualListProps={{
              width: '100%',
              height: 600,
              itemSize: smallViewport ? 70 : 35,
              overscanCount: 5,
            }}
          />
        </PaddedPaper>
      </Stack>
      <UnsavedNavigationAlert
        isDirty={isDirty}
        onProceed={resetLineupToSaved}
      />
      <Box sx={{ display: 'flex', justifyContent: 'end', pt: 1, columnGap: 1 }}>
        <Box flexGrow={1}>
          <RouterButtonLink
            variant="outlined"
            to=".."
            startIcon={<ArrowBack />}
            sx={{ justifyContent: 'flex-start' }}
          >
            Back to Programming
          </RouterButtonLink>
        </Box>
        {isDirty && (
          <Button variant="contained" onClick={() => resetLineupToSaved()}>
            Reset Options
          </Button>
        )}
        <Button
          variant="contained"
          // disabled={(!isValid || !isDirty) && !programsDirty}
          onClick={() => onSave()}
        >
          Save
        </Button>
      </Box>
    </div>
  );
}
