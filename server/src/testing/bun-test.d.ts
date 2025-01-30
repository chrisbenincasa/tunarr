import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';
import 'vitest';

interface CustomMatchers<R = unknown> {
  toMatchPixelFormat: (expected: PixelFormat) => R;
}

declare module 'bun:test' {
  // eslint-disable-next-line @typescript-eslint/no-empty-object-type
  interface Matchers<R = unknown> extends CustomMatchers<R> {}
}
