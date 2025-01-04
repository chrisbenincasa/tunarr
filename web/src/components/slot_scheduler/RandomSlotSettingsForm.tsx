import { DropdownOption } from '@/helpers/DropdownOption.js';
import { flexOptions, padOptions } from '@/helpers/slotSchedulerUtil';
import { RandomSlotForm } from '@/pages/channels/RandomSlotEditorPage';
import {
  setChannelStartTime,
  setCurrentLineup,
} from '@/store/channelEditor/actions';
import { useChannelEditorLazy } from '@/store/selectors';
import { Autorenew } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormGroup,
  FormHelperText,
  Grid2 as Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import { scheduleRandomSlots } from '@tunarr/shared';
import { RandomSlotSchedule } from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import dayjs from 'dayjs';
import { useSnackbar } from 'notistack';
import pluralize from 'pluralize';
import { Controller, useFormContext } from 'react-hook-form';
import { RotatingLoopIcon } from '../base/LoadingIcon';
import { NumericFormControllerText } from '../util/TypedController';

const distributionOptions: DropdownOption<string>[] = [
  { value: 'uniform', description: 'Uniform' },
  { value: 'weighted', description: 'Weighted' },
];

const padStyleOptions: DropdownOption<RandomSlotSchedule['padStyle']>[] = [
  { value: 'episode', description: 'Pad Episodes' },
  { value: 'slot', description: 'Pad Slot' },
];

type Props = {
  onCalculateStart?: () => void;
  onCalculateEnd?: () => void;
};

export const RandomSlotSettingsForm = ({
  onCalculateStart,
  onCalculateEnd,
}: Props) => {
  const { control, getValues, watch } = useFormContext<RandomSlotForm>();
  const padTime = watch('padMs');

  const { materializeOriginalProgramList } = useChannelEditorLazy();
  const snackbar = useSnackbar();
  const [isCalculatingSlots, toggleIsCalculatingSlots] = useToggle(false);

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

  const calculateSlots = async () => {
    performance.mark('guide-start');
    const now = dayjs.tz();
    setChannelStartTime(+now);
    setCurrentLineup([], true);
    onCalculateStart?.();
    toggleIsCalculatingSlots(true);

    await new Promise((resolve) => setTimeout(resolve, 0));

    // let buf: UIChannelProgram[] = [];
    // let offset = 0,
    // index = 0;

    try {
      const previewPrograms = await scheduleRandomSlots(
        {
          ...getValues(),
          timeZoneOffset: new Date().getTimezoneOffset(),
          type: 'random',
        },
        materializeOriginalProgramList(),
        now,
      );
      // for await (const program of schedulePreviewGenerator) {
      //   buf.push({
      //     ...program,
      //     originalIndex: index,
      //     startTimeOffset: offset,
      //   });

      //   offset += program.duration;
      //   index++;

      //   // TODO: Look into if we really want this...
      //   if (buf.length % 10000 === 0) {
      //     appendToCurrentLineup(buf);
      //     buf = [];
      //   }
      // }
      // appendToCurrentLineup(buf);
      setCurrentLineup(previewPrograms);
      performance.mark('guide-end');
      const { duration: ms } = performance.measure(
        'guide',
        'guide-start',
        'guide-end',
      );
      showPerfSnackbar(Math.round(ms), previewPrograms.length);
    } catch (e) {
      console.error(e);
    } finally {
      toggleIsCalculatingSlots(false);
      onCalculateEnd?.();
    }
  };

  return (
    <Box>
      <Typography sx={{ flexGrow: 1, fontWeight: 600 }}>Settings</Typography>
      <Grid container columnSpacing={2} justifyContent={'flex-start'}>
        <Grid size={{ sm: 12, md: 6 }}>
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
        </Grid>
        {padTime > 1 && (
          <Grid size={{ sm: 12, md: 6 }}>
            <FormControl fullWidth margin="normal">
              <InputLabel>Pad Style</InputLabel>
              <Controller
                control={control}
                name="padStyle"
                render={({ field }) => (
                  <Select label="Pad Style" {...field}>
                    {padStyleOptions.map((opt) => (
                      <MenuItem key={opt.value} value={opt.value}>
                        {opt.description}
                      </MenuItem>
                    ))}
                  </Select>
                )}
              />

              <FormHelperText>
                <strong>Pad Slot:</strong> Align slot start times to the
                specified pad time.
                <br />
                <strong>Pad Episode:</strong> Align episode start times (within
                a slot) to the specified pad time. <strong>NOTE:</strong>{' '}
                Depending on slot length and the chosen pad time, this could
                potentially create a lot of flex.
              </FormHelperText>
            </FormControl>
          </Grid>
        )}

        <Grid size={{ sm: 12, md: 6 }}>
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
        </Grid>
        <Grid size={{ sm: 12, md: 6 }}>
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
        </Grid>
        <Grid size={{ sm: 12, md: 6 }}>
          <FormGroup row>
            <NumericFormControllerText
              control={control}
              prettyFieldName="Days to Precalculate"
              TextFieldProps={{
                label: 'Days to Precalculate',
                fullWidth: true,
                margin: 'normal',
              }}
              name="maxDays"
            />

            <FormHelperText sx={{ ml: 1 }}>
              Maximum number of days to precalculate the schedule. Note that the
              length of the schedule is also bounded by the maximum number of
              programs allowed in a channel.
            </FormHelperText>
          </FormGroup>
        </Grid>
      </Grid>
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <Button
          variant="contained"
          onClick={() => calculateSlots().catch(console.error)}
          disabled={isCalculatingSlots}
          startIcon={isCalculatingSlots ? <RotatingLoopIcon /> : <Autorenew />}
        >
          Refresh Preview
        </Button>
      </Box>
    </Box>
  );
};
