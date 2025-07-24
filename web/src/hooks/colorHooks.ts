// import colors from '@mui/material/colors';
import { useColorScheme } from '@mui/material';
import { common } from '@mui/material/colors';
import type { ChannelProgram } from '@tunarr/types';
import type { TimeSlot } from '@tunarr/types/api';
import type Color from 'colorjs.io';
import { useCallback } from 'react';
import {
  pickRandomColor,
  RandomPastels,
  RandomPastelsDarkMode,
} from '../helpers/colors.ts';
import { getProgramGroupingKey } from '../helpers/programUtil.ts';
import { getTimeSlotId } from '../helpers/slotSchedulerUtil.ts';

const useRandomColorPalette = () => {
  const isDarkMode = useColorScheme().mode === 'dark';
  return isDarkMode ? RandomPastelsDarkMode : RandomPastels;
};

export const useRandomProgramBackgroundColor = () => {
  const palette = useRandomColorPalette();
  return useCallback(
    (program: ChannelProgram, paletteOverride?: Color[]) => {
      return pickRandomColor(
        getProgramGroupingKey(program),
        paletteOverride ?? palette,
      );
    },
    [palette],
  );
};

export const useRandomTimeSlotBackgroundColor = () => {
  const palette = useRandomColorPalette();
  return useCallback(
    (slot: TimeSlot, paletteOverride?: Color[]) => {
      return pickRandomColor(getTimeSlotId(slot), paletteOverride ?? palette);
    },
    [palette],
  );
};

export const useGetContrastText = () => {
  return useCallback((color: Color) => {
    return color.contrastWCAG21(common.white) > 3
      ? common.white
      : 'rgba(0, 0, 0, 0.87)';
  }, []);
};
