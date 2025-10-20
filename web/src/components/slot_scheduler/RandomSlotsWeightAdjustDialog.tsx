import { useAdjustRandomSlotWeights } from '@/hooks/slot_scheduler/useAdjustRandomSlotWeights';
import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Slider,
  Stack,
  Typography,
} from '@mui/material';
import { isNumber, isUndefined, map, round, sum } from 'lodash-es';
import { useCallback, useEffect, useState } from 'react';
import { useDebounceCallback } from 'usehooks-ts';
import { useSlotName } from '../../hooks/slot_scheduler/useSlotName.ts';

type Props = {
  open: boolean;
  onClose: () => void;
};

export const UnlockedWeightScale = 24;

export const RandomSlotsWeightAdjustDialog = ({ open, onClose }: Props) => {
  const { slotArray, setValue, watch } = useRandomSlotFormContext();
  const getSlotName = useSlotName();

  const [currentSlots, lockWeights] = watch(['slots', 'lockWeights']);

  const [weights, setWeights] = useState<number[]>(map(currentSlots, 'weight'));
  const totalWeight = sum(weights);

  const adjustRandomSlotWeights = useAdjustRandomSlotWeights();

  useEffect(() => {
    if (open) {
      setWeights(map(currentSlots, 'weight'));
    }
  }, [currentSlots, open]);

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
      if (!lockWeights) {
        let newWeight = isNumber(value) ? value : parseInt(value);
        if (isNaN(newWeight)) {
          return;
        }

        newWeight /= upscaleAmt;
        setWeights((prev) =>
          map(prev, (prev, prevIdx) => (prevIdx === idx ? newWeight : prev)),
        );
        if (commit) {
          updateSlotWeights();
        }
        return;
      }

      const newWeights = adjustRandomSlotWeights(
        weights,
        idx,
        value,
        upscaleAmt,
      );
      if (newWeights) {
        setWeights(newWeights);
        if (commit) {
          updateSlotWeights();
        }
      }
    },
    [adjustRandomSlotWeights, lockWeights, updateSlotWeights, weights],
  );

  const onCommit = () => {
    updateSlotWeights();
    onClose();
  };

  const renderSliders = () => {
    return slotArray.fields.map((slot, idx) => {
      if (isUndefined(weights[idx])) {
        return;
      }

      return (
        <Stack
          key={slot.id}
          spacing={2}
          direction="row"
          sx={{ alignItems: 'center', mb: 1, width: '100%', minHeight: 40 }}
        >
          <Slider
            min={0}
            max={100}
            value={weights[idx]}
            step={0.1}
            onChange={(_, value) => adjustWeights(idx, value, 1)}
            // onChangeCommitted={(_, value) => adjustWeights(idx, value, 1, true)}
            component="div"
            sx={{
              flexBasis: '50%',
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
          <Box>
            <Typography>
              {getSlotName(slot)}{' '}
              {`(${round((weights[idx] / totalWeight) * 100, 2)}%)`}
            </Typography>
          </Box>
        </Stack>
      );
    });
  };

  return (
    <Dialog maxWidth="md" fullWidth open={open} onClose={onClose}>
      <DialogTitle>Adjust Weights</DialogTitle>
      <DialogContent>
        <Stack spacing={2} alignItems="center" sx={{ mt: 1 }}>
          {renderSliders()}
        </Stack>
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
