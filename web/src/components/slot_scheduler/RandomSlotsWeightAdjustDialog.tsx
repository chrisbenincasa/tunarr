import { useAdjustRandomSlotWeights } from '@/hooks/slot_scheduler/useAdjustRandomSlotWeights';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Grid2,
  Slider,
  TextField,
} from '@mui/material';
import { usePrevious } from '@uidotdev/usehooks';
import { map } from 'lodash-es';
import { Fragment, useCallback, useEffect, useState } from 'react';
import { useDebounceCallback } from 'usehooks-ts';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const RandomSlotsWeightAdjustDialog = ({ open, onClose }: Props) => {
  const wasOpen = usePrevious(open);
  const { slotArray, setValue, watch } = useRandomSlotFormContext();

  const currentSlots = watch('slots');

  const [weights, setWeights] = useState<number[]>(map(currentSlots, 'weight'));

  const adjustRandomSlotWeights = useAdjustRandomSlotWeights();

  useEffect(() => {
    if (!wasOpen && open) {
      setWeights(map(currentSlots, 'weight'));
    }
  }, [currentSlots, wasOpen, open]);

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
      const newWeights = adjustRandomSlotWeights(idx, value, upscaleAmt);
      if (newWeights) {
        setWeights(newWeights);
        if (commit) {
          updateSlotWeights();
        }
      }
    },
    [adjustRandomSlotWeights, updateSlotWeights],
  );

  const onCommit = () => {
    updateSlotWeights();
    onClose();
  };

  const renderSliders = () => {
    return slotArray.fields.map((slot, idx) => {
      return (
        <Fragment key={slot.id}>
          <Grid2 size={{ xs: 9 }}>
            <Slider
              min={0}
              max={100}
              value={weights[idx]}
              step={0.1}
              onChange={(_, value) => adjustWeights(idx, value as number, 1)}
              onChangeCommitted={(_, value) =>
                adjustWeights(idx, value as number, 1)
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
          </Grid2>
          <Grid2 size={{ xs: 3 }} sx={{ mt: 1 }}>
            <TextField
              type="number"
              label="Weight %"
              value={weights[idx]}
              disabled
            />
          </Grid2>
        </Fragment>
      );
    });
  };

  return (
    <Dialog maxWidth="sm" fullWidth open={open} onClose={onClose}>
      <DialogTitle>Adjust Weights</DialogTitle>
      <DialogContent>
        <Grid2 container rowSpacing={2} alignItems="center">
          {renderSliders()}
        </Grid2>
      </DialogContent>
      <DialogActions>
        <Button onClick={() => onClose()}>Cancel</Button>
        <Button onClick={() => onCommit()} variant="contained">
          Commit
        </Button>
      </DialogActions>
    </Dialog>
  );
};
