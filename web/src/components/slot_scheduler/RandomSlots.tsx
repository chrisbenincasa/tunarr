import { Grid, Slider, Stack, TextField } from '@mui/material';
import { fill, isNumber, map, range, reject, round } from 'lodash-es';
import { Fragment, useCallback, useEffect, useState } from 'react';
import {
  Control,
  UseFormSetValue,
  UseFormWatch,
  useWatch,
} from 'react-hook-form';
import { useDebounceCallback } from 'usehooks-ts';
import { ProgramOption } from '../../helpers/slotSchedulerUtil';
import { RandomSlotForm } from '../../pages/channels/RandomSlotEditorPage';
import { AddRandomSlotButton } from './AddRandomSlotButton';
import { RandomSlotRow } from './RandomSlotRow';

type RandomSlotsProps = {
  control: Control<RandomSlotForm>;
  setValue: UseFormSetValue<RandomSlotForm>;
  programOptions: ProgramOption[];
  watch: UseFormWatch<RandomSlotForm>;
};
export const RandomSlots = ({
  control,
  setValue,
  programOptions,
  watch,
}: RandomSlotsProps) => {
  const [currentSlots, distribution] = useWatch({
    control,
    name: ['slots', 'randomDistribution'],
  });

  const [weights, setWeights] = useState<number[]>(map(currentSlots, 'weight'));

  useEffect(() => {
    const sub = watch((_, { name, type }) => {
      if (name === 'randomDistribution' && type === 'change') {
        const newWeight = round(100 / currentSlots.length, 2);
        setWeights(fill(Array(currentSlots.length), newWeight));
        setValue(
          'slots',
          map(currentSlots, (slot) => ({ ...slot, weight: newWeight })),
          { shouldDirty: true },
        );
      }
    });
    return () => sub.unsubscribe();
  });

  const updateSlotWeights = useDebounceCallback(
    useCallback(() => {
      setValue(
        'slots',
        map(currentSlots, (cfl, idx) => ({
          ...cfl,
          weight: weights[idx],
        })),
        { shouldDirty: true },
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

  const removeSlot = useCallback(
    (idx: number) => {
      setValue(
        'slots',
        reject(currentSlots, (_, i) => idx === i),
        { shouldDirty: true },
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
      {/* <Button startIcon={<Add />} variant="contained" onClick={() => addSlot()}>
              Add Slot
            </Button> */}
      <AddRandomSlotButton
        control={control}
        setValue={setValue}
        setWeights={setWeights}
      />
    </>
  );
};
