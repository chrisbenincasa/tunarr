import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import 'vitest';

interface CustomMatchers<R = unknown> {
  toMatchPixelFormat: (expected: PixelFormat) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
