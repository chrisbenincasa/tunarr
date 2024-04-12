import * as randomJS from 'random-js';
export const random = new randomJS.Random(
  randomJS.MersenneTwister19937.autoSeed(),
);
