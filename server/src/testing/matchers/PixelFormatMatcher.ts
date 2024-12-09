import { PixelFormat } from '@/ffmpeg/builder/format/PixelFormat.ts';

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
