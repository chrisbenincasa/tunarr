import { Delete } from '@mui/icons-material';
import AddIcon from '@mui/icons-material/Add';
import {
  Alert,
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
  Snackbar,
  TextField,
  Typography,
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
  isNull,
  isNumber,
  isUndefined,
  map,
  maxBy,
  some,
} from 'lodash-es';
import { Fragment, useCallback, useState } from 'react';
import { Link } from 'react-router-dom';
import PaddedPaper from '../../components/base/PaddedPaper.tsx';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList.tsx';
import { useNumberString } from '../../hooks/useNumberString.ts';
import { usePreloadedChannel } from '../../hooks/usePreloadedChannel.ts';
import { clearSlotSchedulePreview } from '../../store/channelEditor/actions.ts';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(dayjsMod);

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

export default function TimeSlotEditorPage() {
  // Requires that the channel was already loaded... not the case if
  // we navigated directly, so we need to handle that
  const { currentEntity: channel, programList: newLineup } =
    usePreloadedChannel();

  const [, setStartTime] = useState(
    channel?.startTime ?? dayjs().unix() * 1000,
  );

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

  // TODO get from the lineup config
  const [timeSlots, setTimeSlots] = useState<TimeSlot[]>([]);
  const [period, setPeriod] = useState<'day' | 'week'>('day');
  const [padOption, setPadOption] = useState<number>(1);
  const [latenessOption, setLatenessOption] = useState<number>(0);
  const [flexOption, setFlexOption] = useState<'end' | 'distribute'>(
    'distribute',
  );
  const {
    numValue: precalcDays,
    strValue: precalcDaysStr,
    setValue: setPrecalcDays,
    isValid: precalcDaysValid,
  } = useNumberString(10);
  const [perfSnackbarDetails, setPerfSnackbarDetails] = useState<{
    ms: number;
    numShows: number;
  } | null>(null);
  const [generatedList, setGeneratedList] = useState<
    ChannelProgram[] | undefined
  >(undefined);
  const isValid = timeSlots.length > 0; // Need more than this

  const onSave = () => {};

  const addSlot = () => {
    setTimeSlots((prev) => {
      const maxSlot = maxBy(prev, (p) => p.startTime);
      const newStartTime = maxSlot
        ? dayjs.duration(maxSlot.startTime).add(1, 'hour')
        : dayjs.duration(new Date().getTimezoneOffset(), 'minutes');
      return [
        ...prev,
        {
          programming: { type: 'flex' },
          startTime: newStartTime.asMilliseconds(),
          order: 'next',
        },
      ];
    });
  };

  const updateSlotTime = useCallback(
    (idx: number, time: dayjs.Dayjs) => {
      setTimeSlots((prev) => {
        const existing = prev[idx];
        const newArr = [...prev];
        newArr[idx] = {
          ...existing,
          startTime: time.mod(dayjs.duration(1, 'day')).asMilliseconds(),
        };
        return newArr;
      });
    },
    [setTimeSlots],
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
      } else {
        return;
      }

      const slot: Omit<TimeSlot, 'startTime'> = {
        order: 'next',
        programming: slotProgram,
      };

      setTimeSlots((prev) => {
        return map(prev, (item, i) => {
          return idx === i ? { ...slot, startTime: item.startTime } : item;
        });
      });
    },
    [setTimeSlots],
  );

  const removeSlot = useCallback(
    (idx: number) => {
      setTimeSlots((prev) => {
        return [...prev.splice(idx, 1)];
      });
    },
    [setTimeSlots],
  );

  const renderTimeSlots = () => {
    const start = dayjs.tz().startOf('day');
    const slots = map(timeSlots, (slot, idx) => {
      const startTime = start
        .add(slot.startTime)
        .subtract(new Date().getTimezoneOffset(), 'minutes');
      const selectValue =
        slot.programming.type === 'show'
          ? `show.${slot.programming.showId}`
          : slot.programming.type;
      return (
        <Fragment key={`${slot.startTime}_${idx}`}>
          <Grid item xs={2}>
            <TimePicker
              onChange={(value) => value && updateSlotTime(idx, value)}
              value={startTime}
              label="Start Time"
            />
          </Grid>
          <Grid item xs={9}>
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
        <Grid item xs={2}>
          Start Time
        </Grid>
        <Grid item xs={10}>
          Program
        </Grid>
        {slots}
      </Grid>
    );
  };

  const calculateSlots = () => {
    const schedule: TimeSlotSchedule = {
      flexPreference: flexOption,
      latenessMs: latenessOption,
      maxDays: precalcDays,
      padMs: padOption,
      timeZoneOffset: new Date().getTimezoneOffset(),
      period,
      type: 'time',
      slots: timeSlots,
    };

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
        setStartTime(res.startTime);
        setGeneratedList(res.programs);
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
            ? `Calculated ${dayjs.duration(365, 'days').humanize()} (${
                perfSnackbarDetails.numShows
              } programs) of programming in ${perfSnackbarDetails.ms}ms`
            : null}
        </Alert>
      </Snackbar>
      <Typography variant="h4" sx={{ mb: 2 }}>
        Edit Time Slots (Channel {channel?.number})
      </Typography>
      <PaddedPaper sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignContent: 'center' }}>
          <Typography sx={{ flexGrow: 1 }}>Time Slots</Typography>
          <Button
            variant="contained"
            onClick={() => calculateSlots()}
            disabled={!isValid}
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
            <Select
              label="Period"
              value={period}
              onChange={(e) => setPeriod(e.target.value as 'day' | 'week')}
            >
              <MenuItem value="day">Daily</MenuItem>
              <MenuItem value="week">Weekly</MenuItem>
            </Select>
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
            <Select
              label="Max Lateness"
              value={latenessOption}
              onChange={(e) =>
                setLatenessOption(
                  isNumber(e.target.value)
                    ? e.target.value
                    : parseInt(e.target.value),
                )
              }
            >
              {latenessOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Allows programs to play a bit late if the previous program took
              longer than usual. If a program is too late, Flex is scheduled
              instead.
            </FormHelperText>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Pad Times</InputLabel>
            <Select
              label="Pad Times"
              onChange={(e) =>
                setPadOption(
                  isNumber(e.target.value)
                    ? e.target.value
                    : parseInt(e.target.value),
                )
              }
              value={padOption}
            >
              {padOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Ensures programs have a nice-looking start time, it will add Flex
              time to fill the gaps.
            </FormHelperText>
          </FormControl>
          <FormControl fullWidth margin="normal">
            <InputLabel>Flex Style</InputLabel>
            <Select
              label="Flex Style"
              value={flexOption}
              onChange={(e) =>
                setFlexOption(e.target.value as 'distribute' | 'end')
              }
            >
              {flexOptions.map((opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
            <FormHelperText>
              Usually slots need to add flex time to ensure that the next slot
              starts at the correct time. When there are multiple videos in the
              slot, you might prefer to distribute the flex time between the
              videos or to place most of the flex time at the end of the slot.
            </FormHelperText>
          </FormControl>
          <FormGroup row>
            <TextField
              fullWidth
              margin="normal"
              label="Days to Precalculate"
              value={precalcDaysStr}
              onChange={(e) => setPrecalcDays(e.target.value)}
              error={!precalcDaysValid}
              helperText="Input must be a number"
            />
            <Typography variant="caption" sx={{ ml: 1 }}>
              Maximum number of days to precalculate the schedule. Note that the
              length of the schedule is also bounded by the maximum number of
              programs allowed in a channel.
            </Typography>
          </FormGroup>
        </Box>
      </PaddedPaper>
      <PaddedPaper>
        <Typography sx={{ pb: 1 }}>
          Programming Preview (
          {generatedList
            ? `${generatedList.length} items, ${dayjs
                .duration(precalcDays, 'days')
                .humanize()}`
            : `${newLineup.length} items`}
          )
        </Typography>
        <Divider />
        <ChannelProgrammingList
          programList={generatedList}
          programListSelector={(s) => s.channelEditor.programList}
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
          component={Link}
          onClick={() => clearSlotSchedulePreview()}
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
