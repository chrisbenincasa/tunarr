import type { PaletteMode } from '@mui/material/styles';
import type { ColorLike } from 'color';
import color from 'color';
import Color from 'colorjs.io';
import { random } from './random.ts';

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

export function generatePastelPalette(baseColors: ColorLike[]) {
  const pastelPalette = [];
  for (const baseColor of baseColors) {
    const colorInstance = color(baseColor);
    const pastelColor = colorInstance.lightness(85).chroma(30); // Adjust L and C values for desired pastel effect
    pastelPalette.push(pastelColor.hex());
  }
  return pastelPalette;
}

export function generateRandomPastelPalette(numColors: number) {
  const pastelPalette = [];
  for (let i = 0; i < numColors; i++) {
    const hue = random.integer(0, 360); // Random hue value (0-360)
    const pastelColor = new Color('oklch', [0.8, 0.2, hue]); // Fixed lightness and chroma
    pastelPalette.push(pastelColor);
  }
  return pastelPalette;
}

export function pickRandomColor(input: string, palette: Color[]): Color {
  const seed = input
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return palette[seed % palette.length];
}

function generateDarkModePalette(numColors = 5) {
  const palette = [];
  for (let i = 0; i < numColors; i++) {
    // Generate a random hue (0-360)
    const hue = random.integer(0, 360);

    // For dark mode, we generally want lighter shades with lower saturation
    // to provide contrast against a dark background.
    // We'll aim for a lightness between 60% and 90% and saturation between 10% and 40%.
    const lightness = random.integer(50, 70);
    const saturation = random.integer(30, 40);

    // Create the color in HSLuv color space, which is perceptually uniform
    const colorInstance = new Color('hsluv', [hue, saturation, lightness]).to(
      'srgb',
    );
    palette.push(colorInstance);
  }
  return palette;
}

const lightModePrimaryText = 'rgba(0, 0, 0, 0.87)';

export function getTextContrast(color: Color, mode: PaletteMode): string {
  if (mode === 'dark') {
    return color.contrastAPCA(lightModePrimaryText) > 50
      ? lightModePrimaryText
      : '#fff';
  } else {
    return color.contrastAPCA('#fff') > 50 ? '#fff' : lightModePrimaryText;
  }
}

export const RandomPastels = generateRandomPastelPalette(100);
export const RandomPastelsDarkMode = generateDarkModePalette(100);
