import { FfmpegSettings } from '@tunarr/types';
import { FfmpegStreamFactory } from './FfmpegStreamFactory.ts';

describe('FfmpegStreamFactory', () => {
  test('create', () => {
    const ffmpegSettings: FfmpegSettings = {};
    new FfmpegStreamFactory();
  });
});
