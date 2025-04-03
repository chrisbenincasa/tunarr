import type { ColorInstance, ColorLike } from 'color';
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
    const hue = Math.random() * 360; // Random hue value (0-360)
    const pastelColor = color.lch([80, 40, hue]); // Fixed lightness and chroma
    pastelPalette.push(pastelColor.hex());
  }
  return pastelPalette;
}

export function pickRandomColor(
  input: string,
  palette: ColorLike[],
): ColorInstance {
  const seed = input
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return color(palette[seed % palette.length]);
}

export const RandomPastels = generateRandomPastelPalette(100);
