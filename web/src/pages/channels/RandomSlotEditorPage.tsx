import { useSlotProgramOptions } from '@/hooks/programming_controls/useSlotProgramOptions';
import { useChannelEditor } from '@/store/selectors';
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
  Stack,
  TextField,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';
import { Link as RouterLink } from '@tanstack/react-router';
import { scheduleRandomSlots } from '@tunarr/shared';
import { RandomSlotSchedule } from '@tunarr/types/api';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import { filter, isNil, isUndefined, map } from 'lodash-es';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { useCallback, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import Breadcrumbs from '../../components/Breadcrumbs';
import PaddedPaper from '../../components/base/PaddedPaper';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList';
import UnsavedNavigationAlert from '../../components/settings/UnsavedNavigationAlert';
import { RandomSlots } from '../../components/slot_scheduler/RandomSlots';
import {
  DropdownOption,
  flexOptions,
  lineupItemAppearsInSchedule,
  padOptions,
} from '../../helpers/slotSchedulerUtil';
import { zipWithIndex } from '../../helpers/util';
import { useUpdateLineup } from '../../hooks/useUpdateLineup';
import {
  resetLineup,
  updateCurrentChannel,
} from '../../store/channelEditor/actions';
import { UIChannelProgram } from '../../types';

dayjs.extend(duration);

export type RandomSlotForm = Omit<
  RandomSlotSchedule,
  'timeZoneOffset' | 'type'
>;

const distributionOptions: DropdownOption<string>[] = [
  { value: 'uniform', description: 'Uniform' },
  { value: 'weighted', description: 'Weighted' },
];

const defaultRandomSlotSchedule: RandomSlotSchedule = {
  type: 'random',
  padStyle: 'episode',
  randomDistribution: 'uniform',
  flexPreference: 'distribute',
  maxDays: 365,
  padMs: 1,
  slots: [],
  timeZoneOffset: new Date().getTimezoneOffset(),
};

export default function RandomSlotEditorPage() {
  const {
    currentEntity: channel,
    programList: newLineup,
    schedule: loadedSchedule,
  } = useChannelEditor();

  const updateLineupMutation = useUpdateLineup();
  const snackbar = useSnackbar();
  const theme = useTheme();
  const smallViewport = useMediaQuery(theme.breakpoints.down('sm'));
  const programOptions = useSlotProgramOptions();

  const hasExistingTimeSlotSchedule =
    !isNil(loadedSchedule) && loadedSchedule.type === 'time';

  const [, setStartTime] = useState(channel?.startTime ?? +dayjs());

  const {
    control,
    getValues,
    setValue,
    watch,
    formState: { isValid, isDirty },
    reset,
  } = useForm<RandomSlotForm>({
    defaultValues:
      !isUndefined(loadedSchedule) && loadedSchedule.type === 'random'
        ? loadedSchedule
        : defaultRandomSlotSchedule,
  });

  const [generatedList, setGeneratedList] = useState<
    UIChannelProgram[] | undefined
  >(undefined);

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

  const resetLineupToSaved = useCallback(() => {
    setGeneratedList(undefined);
    resetLineup();
    reset();
  }, [reset]);

  const onSave = () => {
    const schedule: RandomSlotSchedule = {
      ...getValues(),
      timeZoneOffset: new Date().getTimezoneOffset(),
      type: 'random',
    };

    // Find programs that have active slots
    const filteredLineup = filter(newLineup, (item) =>
      lineupItemAppearsInSchedule(getValues('slots'), item),
    );

    updateLineupMutation.mutate({
      channelId: channel!.id,
      lineupRequest: {
        type: 'random',
        schedule,
        programs: filteredLineup,
      },
    });
  };

  const calculateSlots = () => {
    performance.mark('guide-start');
    scheduleRandomSlots(
      {
        ...getValues(),
        timeZoneOffset: new Date().getTimezoneOffset(),
        type: 'random',
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
    <>
      <Breadcrumbs />
      <Stack gap={2} useFlexGap>
        <Typography variant="h4">
          Edit Random Slots (Channel {channel?.number})
        </Typography>
        {hasExistingTimeSlotSchedule && (
          <Alert severity="warning">
            This channel has an existing time slot schedule. A channel can only
            use one scheduling type at a time. Saving a schedule here will
            remove the existing time slot schedule.
          </Alert>
        )}
        <PaddedPaper>
          <Stack
            direction="row"
            gap={1}
            sx={{ display: 'flex', alignContent: 'center' }}
          >
            <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>
              Random Slots
            </Typography>
          </Stack>
          <Divider sx={{ my: 2 }} />
          <RandomSlots
            control={control}
            setValue={setValue}
            watch={watch}
            programOptions={programOptions}
          />
          <Divider sx={{ my: 2 }} />
          <Box>
            <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>
              Settings
            </Typography>
            <Grid
              container
              spacing={2}
              columns={16}
              justifyContent={'flex-start'}
            >
              <Grid item sm={16} md={8}>
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
              <Grid item sm={16} md={8}>
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
              <Grid item sm={16} md={8}>
                <FormControl fullWidth margin="normal">
                  <InputLabel>Distribution</InputLabel>
                  <Controller
                    control={control}
                    name="randomDistribution"
                    render={({ field }) => (
                      <Select label="Distribution" {...field}>
                        {distributionOptions.map((opt) => (
                          <MenuItem key={opt.value} value={opt.value}>
                            {opt.description}
                          </MenuItem>
                        ))}
                      </Select>
                    )}
                  />
                  <FormHelperText>
                    Uniform means that all slots have an equal chancel to be
                    picked. Weighted makes the configuration of the slots more
                    complicated but allows to tweak the weight for each slot so
                    you can make some slots more likely to be picked than
                    others.
                  </FormHelperText>
                </FormControl>
              </Grid>
              <Grid item sm={16} md={8}>
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
                    Maximum number of days to precalculate the schedule. Note
                    that the length of the schedule is also bounded by the
                    maximum number of programs allowed in a channel.
                  </FormHelperText>
                </FormGroup>
              </Grid>
            </Grid>
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
          </Box>
        </PaddedPaper>
        <PaddedPaper>
          <Typography sx={{ pb: 1 }}>Programming Preview</Typography>

          <Divider />
          {generatedList ? (
            <ChannelProgrammingList
              type={'direct'}
              programList={zipWithIndex(generatedList)}
              enableDnd={false}
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
    </>
  );
}
