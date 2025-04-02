import type { ColorLike } from 'color';
import color from 'color';

export function generateAnalogousPalette(
  baseColor: ColorLike,
  numColors: number = 5,
  hueOffset: number = 30,
) {
  const base = color(baseColor);
  const palette: ColorLike[] = [];
  for (let i = 0; i < numColors; i++) {
    palette.push(base.hue(base.hue() + i * hueOffset).hex());
  }
  return palette;
}

export function generateTintsAndShadesPalette(
  baseColor: ColorLike,
  numTints: number = 3,
  numShades: number = 3,
) {
  const base = color(baseColor);
  const palette = [base.hex()]; // Include the base color

  // Generate tints (lighten)
  for (let i = 1; i <= numTints; i++) {
    palette.push(base.lighten(i * (1 / (numTints + 1))).hex());
  }

  // Generate shades (darken)
  for (let i = 1; i <= numShades; i++) {
    palette.push(base.darken(i * (1 / (numShades + 1))).hex());
  }

  return palette;
}

export function pickRandomColor(
  input: string,
  palette: ColorLike[],
): ColorLike {
  const seed = input
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}
