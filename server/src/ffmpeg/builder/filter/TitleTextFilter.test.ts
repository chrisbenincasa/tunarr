import { FrameSize } from '@/ffmpeg/builder/types.js';
import { describe, expect, test } from 'vitest';
import { TitleTextFilter } from './TitleTextFilter.ts';

describe('TitleTextFilter', () => {
  test('keeps crafted text inside the drawtext quoting', () => {
    const filter = new TitleTextFilter(
      FrameSize.create({ width: 1920, height: 1080 }),
      'Error',
      "x',hue=s=0,drawtext=text='%{pwned}",
    ).filter;

    expect(filter).toBe(
      "drawtext=expansion=none:fontsize=50:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='Error'," +
        "drawtext=expansion=none:fontsize=33:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+66)/2:text='x,hue=s=0,drawtext=text={pwned}'",
    );
  });
});
