import type { FfmpegVersionResult } from '../../../ffmpegInfo.ts';
import {
  defaultHlsOptions,
  FileOutputLocation,
  HlsDirectOutputFormat,
  HlsOutputFormat,
  MpegTsOutputFormat,
  StdoutOutputLocation,
} from '../constants.ts';
import { FfmpegState } from './FfmpegState.ts';

const version: FfmpegVersionResult = {
  versionString: 'unknown',
  isUnknown: true,
};

describe('FfmpegState output isolation', () => {
  test.each([
    ['HLS', HlsOutputFormat],
    ['Direct HLS V2', HlsDirectOutputFormat],
  ] as const)(
    'creating %s does not change existing or subsequent MPEG-TS states',
    (_, makeOutputFormat) => {
      const existing = FfmpegState.defaultWithVersion(version);
      const outputFormat = makeOutputFormat({
        ...defaultHlsOptions,
        segmentBaseDirectory: '/tmp/previous-hls-session',
      });
      const hls = FfmpegState.create({ version, outputFormat });

      expect(hls.outputFormat).toEqual(outputFormat);
      expect(hls.hlsPlaylistPath).toBe(
        '/tmp/previous-hls-session/stream_%v/stream.m3u8',
      );
      expect(MpegTsOutputFormat).toEqual({ type: 'mpegts' });
      for (const state of [
        existing,
        FfmpegState.defaultWithVersion(version),
        FfmpegState.forConcat(version, 'Channel'),
      ]) {
        expect(state.outputFormat).toEqual({ type: 'mpegts' });
        expect(state.hlsPlaylistPath).toBeUndefined();
        expect(state.hlsSegmentTemplate).toBeUndefined();
      }
    },
  );

  test('a file destination does not replace another stream’s stdout destination', () => {
    const existing = FfmpegState.defaultWithVersion(version);
    const outputLocation = FileOutputLocation('/tmp/previous-stream.ts', true);
    const file = FfmpegState.create({ version, outputLocation });

    expect(file.outputLocation).toEqual(outputLocation);
    expect(StdoutOutputLocation).toEqual({ type: 'stdout' });
    expect(existing.outputLocation).toEqual({ type: 'stdout' });
    expect(FfmpegState.defaultWithVersion(version).outputLocation).toEqual({
      type: 'stdout',
    });
  });
});
