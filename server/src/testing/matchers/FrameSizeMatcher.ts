import { expect } from 'vitest';
import { FrameSize } from '../../ffmpeg/builder/types.ts';

expect.extend({
  toMatchFrameSize(received: FrameSize, expected: FrameSize) {
    const { isNot } = this;
    return {
      pass: received.equals(expected),
      message: () => `${received} is${isNot ? ' not' : ''} ${expected}`,
    };
  },
});
