import type { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.js';

expect.extend({
  toMatchPixelFormat(received: PixelFormat, expected: PixelFormat) {
    const { isNot } = this;
    return {
      pass: received.equals(expected),
      message: () =>
        `${received.prettyPrint()} is${
          isNot ? ' not' : ''
        } ${expected.prettyPrint()}`,
    };
  },
});
