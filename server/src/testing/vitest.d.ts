/* eslint-disable @typescript-eslint/no-empty-object-type */
import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import 'vitest';
import { FrameSize } from '../ffmpeg/builder/types.ts';

interface CustomMatchers<R = unknown> {
  toMatchPixelFormat: (expected: PixelFormat) => R;
  toMatchFrameSize: (expected: FrameSize) => R;
}

declare module 'vitest' {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  interface Assertion<T = any> extends CustomMatchers<T> {}
  interface AsymmetricMatchersContaining extends CustomMatchers {}
}
