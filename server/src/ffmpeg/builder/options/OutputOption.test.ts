import { MapAllNonSubtitleStreamsOutputOption } from '@/ffmpeg/builder/options/OutputOption.js';

describe('MapAllNonSubtitleStreamsOutputOption', () => {
  test('maps video without attached pictures, all audio, and optional data', () => {
    expect(MapAllNonSubtitleStreamsOutputOption().options()).to.deep.eq([
      '-map',
      '0:V',
      '-map',
      '0:a',
      '-map',
      '0:d?',
    ]);
  });
});
