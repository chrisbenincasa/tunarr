import { Delete } from '@mui/icons-material';
import Add from '@mui/icons-material/Add';
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
  Slider,
  Snackbar,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
// import { useQueryClient } from '@tanstack/react-query';
import { scheduleRandomSlots } from '@tunarr/shared';
import { isContentProgram } from '@tunarr/types';
import {
  RandomSlot,
  RandomSlotProgramming,
  RandomSlotSchedule,
} from '@tunarr/types/api';
import { usePrevious } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import duration from 'dayjs/plugin/duration';
import {
  chain,
  fill,
  filter,
  isNil,
  isNull,
  isNumber,
  isUndefined,
  map,
  range,
  reject,
  round,
  some,
} from 'lodash-es';
import React, {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import {
  Control,
  Controller,
  UseFormSetValue,
  useForm,
  useWatch,
} from 'react-hook-form';
import { useDebounceCallback } from 'usehooks-ts';
import Breadcrumbs from '../../components/Breadcrumbs';
import PaddedPaper from '../../components/base/PaddedPaper';
import ChannelProgrammingList from '../../components/channel_config/ChannelProgrammingList';
import {
  DropdownOption,
  ProgramOption,
  flexOptions,
  padOptions,
} from '../../components/slot_scheduler/commonSlotSchedulerOptions';
import { handleNumericFormValue, zipWithIndex } from '../../helpers/util';
import { usePreloadedChannelEdit } from '../../hooks/usePreloadedChannel';
import { updateCurrentChannel } from '../../store/channelEditor/actions';
import { UIChannelProgram } from '../../types';

dayjs.extend(duration);

type RandomSlotForm = Omit<RandomSlotSchedule, 'timeZoneOffset' | 'type'>;

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
  { value: '', description: '' },
  { value: 'shuffle', description: 'Shuffle' },
  { value: 'next', description: 'Play Next' },
];

const distributionOptions: DropdownOption<string>[] = [
  { value: 'uniform', description: 'Uniform' },
  { value: 'weighted', description: 'Weighted' },
];

const defaultRandomSlotSchedule: RandomSlotSchedule = {
  type: 'random',
  padStyle: 'episode',
  randomDistribution: 'uniform',
  flexPreference: 'distribute',
  maxDays: 10,
  padMs: 1,
  slots: [],
  timeZoneOffset: new Date().getTimezoneOffset(),
};

type RandomSlotRowProps = {
  index: number;
  control: Control<RandomSlotForm>;
  setValue: UseFormSetValue<RandomSlotForm>;
  programOptions: ProgramOption[];
  removeSlot: (idx: number) => void;
};

const RandomSlotRow = React.memo(
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
          // TODO: Support redirect
        } else {
          return;
        }

        const newSlot: RandomSlot = {
          ...slot,
          order: slotProgram.type === 'show' ? 'next' : '',
          programming: slotProgram,
        };

        setValue(`slots.${idx}`, { ...newSlot });
      },
      [setValue, slot],
    );

    const updateSlot = useCallback(
      (idx: number, newSlot: Partial<RandomSlot>) => {
        setValue(`slots.${idx}`, { ...slot, ...newSlot });
      },
      [setValue],
    );

    const selectValue =
      slot.programming.type === 'show'
        ? `show.${slot.programming.showId}`
        : slot.programming.type;

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
          {slot.programming.type === 'show' && (
            <Select
              fullWidth
              value={slot.order ?? 'none'}
              onChange={(e) => updateSlot(index, { order: e.target.value })}
            >
              {map(slotOrderOptions, (opt) => (
                <MenuItem key={opt.value} value={opt.value}>
                  {opt.description}
                </MenuItem>
              ))}
            </Select>
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

type RandomSlotsProps = {
  control: Control<RandomSlotForm>;
  setValue: UseFormSetValue<RandomSlotForm>;
  programOptions: ProgramOption[];
};

const RandomSlots = ({
  control,
  setValue,
  programOptions,
}: RandomSlotsProps) => {
  const [currentSlots, distribution] = useWatch({
    control,
    name: ['slots', 'randomDistribution'],
  });

  const prevDistribution = usePrevious(distribution);

  const [weights, setWeights] = useState<number[]>(map(currentSlots, 'weight'));

  // This is kinda gnarly -- will fix
  useEffect(() => {
    if (distribution !== prevDistribution) {
      const newWeight = round(100 / currentSlots.length, 2);
      setWeights(fill(Array(currentSlots.length), newWeight));
      setValue(
        'slots',
        map(currentSlots, (slot) => ({ ...slot, weight: newWeight })),
      );
    }
  }, [prevDistribution, distribution]);

  const updateSlotWeights = useDebounceCallback(
    useCallback(() => {
      setValue(
        'slots',
        map(currentSlots, (cfl, idx) => ({
          ...cfl,
          weight: weights[idx],
        })),
      );
    }, [currentSlots, setValue, weights]),
    500,
  );

  const adjustWeights = useCallback(
    (
      idx: number,
      value: string | number,
      upscaleAmt: number,
      commit: boolean = false,
    ) => {
      let newWeight = isNumber(value) ? value : parseInt(value);
      if (isNaN(newWeight)) {
        return;
      }
      newWeight /= upscaleAmt;
      const oldWeight = weights[idx];
      const scale = round((newWeight - oldWeight) / oldWeight, 2);
      if (scale === 0) {
        return;
      }
      const newRemainingWeight = 100 - newWeight;
      const oldRemainingWeight = 100 - oldWeight;

      const newWeights = map(range(currentSlots.length), (i) => {
        if (idx === i) {
          return newWeight;
        } else if (weights[i] === 0) {
          // If the adjusted slot is coming down from 100% weight
          // just distribute the remaining weight among the other slots
          return round(newRemainingWeight / (currentSlots.length - 1), 2);
        } else {
          // Take the percentage portion of the old weight
          // from the newRemainingWeight. This scales the weights
          // relative to their existing proportion.

          const prevWeight = weights[i];
          const prevPortion = round(prevWeight / oldRemainingWeight, 4);
          return round(newRemainingWeight * prevPortion, 2);
        }
      });

      setWeights(newWeights);

      if (commit) {
        updateSlotWeights();
      }
    },
    [currentSlots, updateSlotWeights, weights],
  );

  const addSlot = useCallback(() => {
    let newSlots: RandomSlot[];
    const newSlot: Omit<RandomSlot, 'weight'> = {
      programming: {
        type: 'flex',
      },
      durationMs: dayjs.duration({ minutes: 30 }).asMilliseconds(),
      cooldownMs: 0,
      order: '', // figure out what this does
    };

    if (distribution === 'uniform') {
      const slot = { ...newSlot, weight: 100 };
      newSlots = [...currentSlots, slot];
    } else {
      const newWeight = round(100 / (currentSlots.length + 1), 2);
      const distributeWeight = round(
        (100 - newWeight) / currentSlots.length,
        2,
      );
      const slot = { ...newSlot, weight: newWeight };
      const oldSlots = map(currentSlots, (slot) => ({
        ...slot,
        weight: distributeWeight,
      }));
      newSlots = [...oldSlots, slot];
    }

    setWeights(map(newSlots, 'weight'));
    setValue('slots', newSlots);
  }, [currentSlots, setWeights, distribution]);

  const removeSlot = useCallback(
    (idx: number) => {
      setValue(
        'slots',
        reject(currentSlots, (_, i) => idx === i),
      );
    },
    [setValue, currentSlots],
  );

  const renderSlots = () => {
    const slots = map(currentSlots, (slot, idx) => {
      return (
        <Fragment key={`${slot.programming.type}_${idx}`}>
          <RandomSlotRow
            key={`${slot.programming.type}_${idx}`}
            index={idx}
            programOptions={programOptions}
            setValue={setValue}
            control={control}
            removeSlot={removeSlot}
          />
          {distribution === 'weighted' && (
            <Grid item xs={12}>
              <Stack direction="row" spacing={2} alignItems="center">
                <Slider
                  min={0}
                  max={100}
                  value={weights[idx]}
                  step={0.1}
                  onChange={(_, value) =>
                    adjustWeights(idx, value as number, 1)
                  }
                  onChangeCommitted={(_, value) =>
                    adjustWeights(idx, value as number, 1, true)
                  }
                  sx={{
                    width: '90%',
                    '& .MuiSlider-thumb': {
                      transition: 'left 0.1s',
                    },
                    '& .MuiSlider-thumb.MuiSlider-active': {
                      transition: 'left 0s',
                    },
                    '& .MuiSlider-track': {
                      transition: 'width 0.1s',
                    },
                  }}
                />
                <TextField
                  type="number"
                  label="Weight %"
                  value={weights[idx]}
                  disabled
                />
              </Stack>
            </Grid>
          )}
        </Fragment>
      );
    });

    return (
      <Grid container spacing={2} sx={{ mb: 2 }}>
        <Grid item xs={2}>
          Duration
        </Grid>
        <Grid item xs={5}>
          Program
        </Grid>
        <Grid item xs={2}>
          Cooldown
        </Grid>
        <Grid item xs={2}>
          Order
        </Grid>
        <Grid item xs={1}></Grid>
        {slots}
      </Grid>
    );
  };

  return (
    <>
      <Grid container>{renderSlots()}</Grid>
      <Button startIcon={<Add />} variant="contained" onClick={() => addSlot()}>
        Add Slot
      </Button>
    </>
  );
};

export default function RandomSlotEditorPage() {
  // Requires that the channel was already loaded... not the case if
  // we navigated directly, so we need to handle that
  const {
    currentEntity: channel,
    programList: newLineup,
    schedule: loadedSchedule,
  } = usePreloadedChannelEdit();

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

    return opts;
  }, [newLineup]);

  const hasExistingTimeSlotSchedule =
    !isNil(loadedSchedule) && loadedSchedule.type === 'time';

  const [, setStartTime] = useState(
    channel?.startTime ?? dayjs().unix() * 1000,
  );

  // const queryClient = useQueryClient();

  const { control, getValues, setValue } = useForm<RandomSlotForm>({
    defaultValues:
      !isUndefined(loadedSchedule) && loadedSchedule.type === 'random'
        ? loadedSchedule
        : defaultRandomSlotSchedule,
  });

  const schedule: RandomSlotSchedule = {
    ...getValues(),
    timeZoneOffset: new Date().getTimezoneOffset(),
    type: 'random',
  };

  const [perfSnackbarDetails, setPerfSnackbarDetails] = useState<{
    ms: number;
    numShows: number;
  } | null>(null);

  const [generatedList, setGeneratedList] = useState<
    UIChannelProgram[] | undefined
  >(undefined);

  const calculateSlots = () => {
    performance.mark('guide-start');
    console.log(schedule);
    scheduleRandomSlots(schedule, newLineup)
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
    <>
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
      {hasExistingTimeSlotSchedule && (
        <Alert variant="filled" severity="warning">
          This channel has an existing time slot schedule
        </Alert>
      )}
      <Breadcrumbs />
      <Typography variant="h4" sx={{ mb: 2 }}>
        Edit Random Slots (Channel {channel?.number})
      </Typography>
      <PaddedPaper sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignContent: 'center' }}>
          <Typography sx={{ flexGrow: 1 }}>Random Slots</Typography>
          <Button variant="contained" onClick={() => calculateSlots()}>
            Refresh
          </Button>
        </Box>
        <Divider sx={{ my: 2 }} />
        <RandomSlots
          control={control}
          setValue={setValue}
          programOptions={programOptions}
        />
        <Divider sx={{ my: 2 }} />
        <Box>
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
              Uniform means that all slots have an equal chancel to be picked.
              Weighted makes the configuration of the slots more complicated but
              allows to tweak the weight for each slot so you can make some
              slots more likely to be picked than others.
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
    </>
  );
}
