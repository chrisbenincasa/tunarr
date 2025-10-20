import { isNumber, map, range, round } from 'lodash-es';
import { useCallback } from 'react';

export const useAdjustRandomSlotWeights = () => {
  return useCallback(
    (
      weights: number[],
      idx: number,
      value: string | number,
      upscaleAmt: number,
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

      return map(range(weights.length), (i) => {
        if (idx === i) {
          return newWeight;
        } else if (weights[i] === 0) {
          // If the adjusted slot is coming down from 100% weight
          // just distribute the remaining weight among the other slots
          return round(newRemainingWeight / (weights.length - 1), 2);
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
    [],
  );
};
