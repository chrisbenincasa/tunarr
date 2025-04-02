// import colors from '@mui/material/colors';
import { flatten } from 'lodash-es';
import { generateTintsAndShadesPalette } from '../helpers/colors.ts';
import { random } from '../helpers/random.ts';

export const randomColorSet1 = random.shuffle(
  flatten([
    generateTintsAndShadesPalette('#008c93', 10, 0),
    generateTintsAndShadesPalette('lightgreen', 10, 0),
    generateTintsAndShadesPalette('red', 10, 0),
  ]),
);
