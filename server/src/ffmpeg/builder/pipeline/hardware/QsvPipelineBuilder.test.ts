import { FileStreamSource } from '../../../../stream/types.ts';
import { FfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from '../../capabilities/VaapiHardwareCapabilities.ts';
import { PixelFormatYuv420P } from '../../format/PixelFormat.ts';
import { SubtitlesInputSource } from '../../input/SubtitlesInputSource.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { WatermarkInputSource } from '../../input/WatermarkInputSource.ts';
import {
  EmbeddedSubtitleStream,
  StillImageStream,
  SubtitleMethods,
  VideoStream,
} from '../../MediaStream.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameSize } from '../../types.ts';
import { QsvPipelineBuilder } from './QsvPipelineBuilder.ts';

// Shared test fixtures

const ffmpegVersion = {
  versionString: 'n7.0.2-15-g0458a86656-20240904',
  majorVersion: 7,
  minorVersion: 0,
  patchVersion: 2,
  isUnknown: false,
} as const;

function makeVaapiCapabilities(
  profiles: VaapiProfileEntrypoint[] = [],
): VaapiHardwareCapabilities {
  return new VaapiHardwareCapabilities(profiles);
}

function makeH264DecodeEncodeCapabilities(): VaapiHardwareCapabilities {
  return new VaapiHardwareCapabilities([
    new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Decode),
    new VaapiProfileEntrypoint(VaapiProfiles.H264Main, VaapiEntrypoint.Encode),
  ]);
}

function makeEmptyBinaryCapabilities(): FfmpegCapabilities {
  return new FfmpegCapabilities(new Set(), new Map(), new Set());
}

function makeH264VideoInputNonSquare(): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.withDimensions(1920, 900),
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeH264ProfileVideoInput(): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      profile: 'main',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.withDimensions(1920, 900),
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeWatermark(duration = 5): WatermarkInputSource {
  return new WatermarkInputSource(
    new FileStreamSource('/path/to/watermark.jpg'),
    StillImageStream.create({
      frameSize: FrameSize.withDimensions(800, 600),
      index: 0,
    }),
    {
      duration,
      enabled: true,
      horizontalMargin: 5,
      opacity: 100,
      position: 'bottom-right',
      verticalMargin: 5,
      width: 10,
    },
  );
}

function makePgsSubtitles(): SubtitlesInputSource {
  return new SubtitlesInputSource(
    new FileStreamSource('/path/to/video.mkv'),
    [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
    SubtitleMethods.Burn,
  );
}

function makeDesiredFrameState(
  video: VideoInputSource,
  overrides?: Partial<ConstructorParameters<typeof FrameState>[0]>,
): FrameState {
  return new FrameState({
    isAnamorphic: false,
    scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
    paddedSize: FrameSize.FHD,
    pixelFormat: new PixelFormatYuv420P(),
    ...overrides,
  });
}

describe('QsvPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = makeVaapiCapabilities();
    const binaryCapabilities = makeEmptyBinaryCapabilities();
    const video = makeH264VideoInputNonSquare();
    const watermark = makeWatermark();

    const builder = new QsvPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      watermark,
      makePgsSubtitles(),
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        frameRate: 24,
      }),
      DefaultPipelineOptions,
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-init_hw_device",
        "qsv=hw:hw,child_device_type=vaapi",
        "-filter_hw_device",
        "hw",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]setpts=PTS-STARTPTS,fps=24,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
        "-map",
        "[vwm]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-r",
        "24",
        "-fps_mode",
        "cfr",
        "-sc_threshold",
        "0",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work, decoding disabled', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = makeEmptyBinaryCapabilities();
    const video = makeH264VideoInputNonSquare();
    const watermark = makeWatermark();

    const builder = new QsvPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      watermark,
      makePgsSubtitles(),
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video, { videoFormat: 'h264' }),
      { ...DefaultPipelineOptions, disableHardwareDecoding: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-init_hw_device",
        "qsv=hw:hw,child_device_type=vaapi",
        "-filter_hw_device",
        "hw",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]setpts=PTS-STARTPTS,fps=24,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
        "-map",
        "[vwm]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-c:v",
        "h264_qsv",
        "-low_power",
        "0",
        "-look_ahead",
        "0",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work, encoding disabled', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = makeEmptyBinaryCapabilities();
    const video = makeH264ProfileVideoInput();
    const watermark = makeWatermark(0);

    const builder = new QsvPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      watermark,
      null,
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video, { videoFormat: 'h264' }),
      { ...DefaultPipelineOptions, disableHardwareEncoding: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-hwaccel",
        "qsv",
        "-hwaccel_output_format",
        "qsv",
        "-init_hw_device",
        "qsv=hw:hw,child_device_type=vaapi",
        "-filter_hw_device",
        "hw",
        "-c:v",
        "h264_qsv",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]setpts=PTS-STARTPTS,fps=24,hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0[vwm]",
        "-map",
        "[vwm]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-sc_threshold",
        "0",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });

  test('should work, filters disabled', () => {
    const capabilities = makeH264DecodeEncodeCapabilities();
    const binaryCapabilities = makeEmptyBinaryCapabilities();
    const video = makeH264ProfileVideoInput();
    const watermark = makeWatermark();

    const builder = new QsvPipelineBuilder(
      capabilities,
      binaryCapabilities,
      video,
      null,
      null,
      watermark,
      makePgsSubtitles(),
    );

    const state = FfmpegState.create({ version: ffmpegVersion });

    const out = builder.build(
      state,
      makeDesiredFrameState(video, { videoFormat: 'h264' }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-threads",
        "1",
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-hwaccel",
        "qsv",
        "-hwaccel_output_format",
        "qsv",
        "-init_hw_device",
        "qsv=hw:hw,child_device_type=vaapi",
        "-filter_hw_device",
        "hw",
        "-c:v",
        "h264_qsv",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]setpts=PTS-STARTPTS,fps=24,hwdownload,format=nv12,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
        "-map",
        "[vwm]",
        "-map",
        "0:a",
        "-muxdelay",
        "0",
        "-muxpreload",
        "0",
        "-flags",
        "cgop",
        "-movflags",
        "+faststart",
        "-c:v",
        "h264_qsv",
        "-low_power",
        "0",
        "-look_ahead",
        "0",
        "-c:a",
        "copy",
        "-f",
        "mpegts",
        "pipe:1",
      ]
    `);
  });
});
