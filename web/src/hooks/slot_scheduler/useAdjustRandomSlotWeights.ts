import { useRandomSlotFormContext } from '@/hooks/useRandomSlotFormContext';
import { isNumber, map, range, round } from 'lodash-es';
import { useCallback, useMemo } from 'react';

export const useAdjustRandomSlotWeights = () => {
  const { watch } = useRandomSlotFormContext();

  const currentSlots = watch('slots');
  const weights = useMemo(() => map(currentSlots, 'weight'), [currentSlots]);

  return useCallback(
    (idx: number, value: string | number, upscaleAmt: number) => {
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

      return map(range(currentSlots.length), (i) => {
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
    },
    [currentSlots, weights],
  );
};
