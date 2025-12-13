import type { DropdownOption } from '@/helpers/DropdownOption.js';
import { flexOptions, padOptions } from '@/helpers/slotSchedulerUtil';
import type { RandomSlotForm } from '@/model/SlotModels.ts';

import { Autorenew } from '@mui/icons-material';
import {
  Box,
  Button,
  Divider,
  FormControl,
  FormControlLabel,
  FormGroup,
  FormHelperText,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  Typography,
} from '@mui/material';
import type {
  RandomSlotDistributionType,
  RandomSlotSchedule,
} from '@tunarr/types/api';
import { useToggle } from '@uidotdev/usehooks';
import { Controller, useFormContext } from 'react-hook-form';
import { useScheduleSlots } from '../../hooks/slot_scheduler/useScheduleSlots.ts';
import { RotatingLoopIcon } from '../base/LoadingIcon';
import {
  CheckboxFormController,
  NumericFormControllerText,
} from '../util/TypedController';

const distributionOptions: DropdownOption<RandomSlotDistributionType>[] = [
  { value: 'uniform', description: 'Uniform' },
  { value: 'weighted', description: 'Weighted' },
  { value: 'none', description: 'None' },
];

const padStyleOptions: DropdownOption<RandomSlotSchedule['padStyle']>[] = [
  { value: 'episode', description: 'Pad Episodes' },
  { value: 'slot', description: 'Pad Slot' },
];

type Props = {
  onCalculateStart?: () => void;
  onCalculateEnd?: (state?: { seed?: number[]; discardCount?: number }) => void;
};

export const RandomSlotSettingsForm = ({
  onCalculateStart,
  onCalculateEnd,
}: Props) => {
  const { control, getValues, watch } = useFormContext<RandomSlotForm>();
  const [padTime, distributionType] = watch(['padMs', 'randomDistribution']);

  const [isCalculatingSlots, toggleIsCalculatingSlots] = useToggle(false);

  const { scheduleSlots } = useScheduleSlots();

  const calculateSlots = () => {
    toggleIsCalculatingSlots(true);
    onCalculateStart?.();
    const values = getValues();
    scheduleSlots({
      ...values,
      slots: values.slots.map((slot, idx) => ({ ...slot, index: idx })),
    })
      .then(({ seed, discardCount }) => {
        onCalculateEnd?.({ seed, discardCount });
      })
      .catch((e) => {
        console.error(e);
        onCalculateEnd?.();
      })
      .finally(() => {
        toggleIsCalculatingSlots(false);
      });
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
              Ensures programs start only at a particular interval within the
              hour. This makes for nice looking schedules. Flex time is
              scheduled to facilitate.
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
              If no more programs can fit into a duration-based slot, flex time
              is added to fill the gap. This setting determines how flex is
              added <i>within</i> the slot to ensure all time is filled.
              <br />
              <strong>Between:</strong> Flex time is added between videos within
              a slot, if there are multiple
              <br />
              <strong>End:</strong> Flex time is added at the end of the slot
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
              <strong>None:</strong> slots are picked in the order they are
              specified in the table (i.e. not randomly)
              <br />
              <strong>Uniform:</strong> all slots have an equal chance to be
              picked.
              <br />
              <strong>Weighted:</strong> each slot is picked with a specified
              probability
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
        {distributionType === 'weighted' && (
          <Grid size={{ sm: 12, md: 6 }}>
            <FormGroup row>
              <FormControlLabel
                control={
                  <CheckboxFormController
                    control={control}
                    name="lockWeights"
                  />
                }
                label="Lock Weights"
              />

              <FormHelperText sx={{ ml: 1 }}>
                If true, adjusting the weight of one slot will scale the weights
                of other slots such that all weights total 100%. Otherwise,
                weights can be adjusted freely and the weight of each slot is
                only relative to the total weight.
              </FormHelperText>
            </FormGroup>
          </Grid>
        )}
      </Grid>
      <Divider sx={{ my: 4 }} />
      <Box sx={{ display: 'flex', justifyContent: 'center', my: 4 }}>
        <Button
          variant="contained"
          onClick={() => calculateSlots()}
          disabled={isCalculatingSlots}
          startIcon={isCalculatingSlots ? <RotatingLoopIcon /> : <Autorenew />}
        >
          Refresh Preview
        </Button>
      </Box>
    </Box>
  );
};
