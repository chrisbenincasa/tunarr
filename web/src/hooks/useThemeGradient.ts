import * as colors from '@mui/material/colors';
import { flatMap, reject, uniq } from 'lodash-es';

type Key = keyof typeof colors;
type ValueOf<T> = T[keyof T];
type Values = keyof ValueOf<typeof colors>;
const hueChoices = reject(Object.keys(colors), (c) => c === 'common');
const lightnessChoices = uniq(
  flatMap(hueChoices, (c) => Object.keys(colors[c as Key])),
);

export function randomColor() {
  const hue = hueChoices[Math.round(Math.random() * 10) % hueChoices.length];
  const lightness =
    lightnessChoices[Math.round(Math.random() * 10) % lightnessChoices.length];
  return colors[hue as Key][lightness as Values];
}

export function randomGradient(): [string, string] {
  const hue = hueChoices[
    Math.round(Math.random() * 10) % hueChoices.length
  ] as Key;
  const lightnessIdx = Math.round(Math.random() * 10) % lightnessChoices.length;
  const lightness = lightnessChoices[lightnessIdx] as Values;
  const next = lightnessChoices[
    (lightnessIdx + 8) % lightnessChoices.length
  ] as Values;

  return [colors[hue][lightness], colors[hue][next]];
}

export const useThemeGradient = () => {};
