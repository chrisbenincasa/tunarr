import { FileStreamSource } from '../../../../stream/types.ts';
import { EmptyFfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
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
import { SoftwarePipelineBuilder } from './SoftwarePipelineBuilder.ts';

// Shared test fixtures

const ffmpegVersion = {
  versionString: 'n7.0.2',
  majorVersion: 7,
  minorVersion: 0,
  patchVersion: 2,
  isUnknown: false,
} as const;

function makeH264VideoInput(frameSize = FrameSize.FHD): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize,
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeH264VideoInputFourK(): VideoInputSource {
  return VideoInputSource.withStream(
    new FileStreamSource('/path/to/video.mkv'),
    VideoStream.create({
      codec: 'h264',
      displayAspectRatio: '16:9',
      frameSize: FrameSize.FourK,
      index: 0,
      pixelFormat: new PixelFormatYuv420P(),
      providedSampleAspectRatio: null,
    }),
  );
}

function makeWatermark(opacity = 100, duration = 5): WatermarkInputSource {
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
      opacity,
      position: 'bottom-right',
      verticalMargin: 5,
      width: 10,
    },
  );
}

function makePgsSubtitles(
  source?: FileStreamSource,
): SubtitlesInputSource {
  return new SubtitlesInputSource(
    source ?? new FileStreamSource('/path/to/video.mkv'),
    [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
    SubtitleMethods.Burn,
  );
}

function makeTextSubtitles(
  source?: FileStreamSource,
): SubtitlesInputSource {
  // 'subrip' (SRT) is a text-based subtitle codec, not image-based
  return new SubtitlesInputSource(
    source ?? new FileStreamSource('/path/to/video.mkv'),
    [new EmbeddedSubtitleStream('subrip', 5, SubtitleMethods.Burn)],
    SubtitleMethods.Burn,
  );
}

function makeDefaultFfmpegState(): FfmpegState {
  return FfmpegState.create({ version: ffmpegVersion });
}

function makeDesiredFrameState(
  video: VideoInputSource,
  overrides?: Partial<ConstructorParameters<typeof FrameState>[0]>,
): FrameState {
  return new FrameState({
    isAnamorphic: false,
    scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
    paddedSize: FrameSize.FHD,
    pixelFormat: new PixelFormatYuv420P(),
    ...overrides,
  });
}

describe('SoftwarePipelineBuilder', () => {
  test('basic H264 to H264 transcode', () => {
    const video = makeH264VideoInput();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      makeDesiredFrameState(video),
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
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black[v]",
        "-map",
        "[v]",
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

  test('scale down from 4K to 1080p', () => {
    const video = makeH264VideoInputFourK();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      // Desired output is FHD, input is 4K → scale down
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      }),
      DefaultPipelineOptions,
    );

    const args = out.getCommandArgs().join(' ');
    expect(args).toContain('scale');
    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear[v]",
        "-map",
        "[v]",
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

  test('scale down from non-square aspect ratio to FHD with padding', () => {
    // 1920x900 → 1920x1080 with pad
    const video = VideoInputSource.withStream(
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

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      makeDesiredFrameState(video),
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
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]pad=1920:1080:-1:-1:color=black[v]",
        "-map",
        "[v]",
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

  test('with watermark overlay', () => {
    const video = makeH264VideoInput();
    const watermark = makeWatermark();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      watermark,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      makeDesiredFrameState(video),
      DefaultPipelineOptions,
    );

    const args = out.getCommandArgs().join(' ');
    expect(args).toContain('overlay');
    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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

  test('with watermark overlay at opacity=50', () => {
    const video = makeH264VideoInput();
    const watermark = makeWatermark(50);

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      watermark,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      makeDesiredFrameState(video),
      DefaultPipelineOptions,
    );

    const args = out.getCommandArgs().join(' ');
    expect(args).toContain('colorchannelmixer');
    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black[v];[1:0]scale=192:-1,format=yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,colorchannelmixer=aa=0.5[wm];[v][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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

  test('with image-based subtitle burn-in (PGS)', () => {
    const videoSource = new FileStreamSource('/path/to/video.mkv');
    const video = makeH264VideoInput();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      makePgsSubtitles(videoSource),
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      makeDesiredFrameState(video),
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
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black[v];[0:5]scale=1920:1080:force_original_aspect_ratio=decrease[sub];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub]",
        "-map",
        "[vsub]",
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

  test('with text subtitle burn-in (SRT/subrip)', () => {
    const videoSource = new FileStreamSource('/path/to/video.mkv');
    const video = makeH264VideoInput();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      makeTextSubtitles(videoSource),
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      makeDesiredFrameState(video),
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
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-copyts",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear:force_original_aspect_ratio=decrease,pad=1920:1080:-1:-1:color=black,subtitles=/path/to/video.mkv[v]",
        "-map",
        "[v]",
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

  test('deinterlace', () => {
    const video = makeH264VideoInput();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        deinterlace: true,
      }),
      DefaultPipelineOptions,
    );

    const args = out.getCommandArgs().join(' ');
    expect(args).toContain('yadif');
    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-filter_complex",
        "[0:0]yadif=1[v]",
        "-map",
        "[v]",
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

  test('copy passthrough (video format = copy)', () => {
    const video = makeH264VideoInput();

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'copy',
      }),
      DefaultPipelineOptions,
    );

    const args = out.getCommandArgs().join(' ');
    expect(args).toContain('copy');
    expect(out.getCommandArgs()).toMatchInlineSnapshot(`
      [
        "-nostdin",
        "-hide_banner",
        "-nostats",
        "-loglevel",
        "error",
        "-fflags",
        "+genpts+discardcorrupt+igndts",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-map",
        "0:0",
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
        "copy",
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

  test('all options combined: scale + watermark + image subtitles', () => {
    const videoSource = new FileStreamSource('/path/to/video.mkv');
    // Use 4K input so scaling is needed
    const video = makeH264VideoInputFourK();
    const watermark = makeWatermark(75);

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      watermark,
      makePgsSubtitles(videoSource),
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
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
        "-c:v",
        "h264",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-i",
        "/path/to/watermark.jpg",
        "-filter_complex",
        "[0:0]scale=iw*sar:ih,setsar=1,scale=1920:1080:flags=fast_bilinear[v];[0:5]scale=1920:1080:force_original_aspect_ratio=decrease[sub];[1:0]scale=192:-1,format=yuva420p|yuva444p|yuva422p|rgba|abgr|bgra|gbrap|ya8,colorchannelmixer=aa=0.75[wm];[v][sub]overlay=x=(W-w)/2:y=(H-h)/2:format=0[vsub];[vsub][wm]overlay=x=W-w-96:y=H-h-54:format=0:enable='between(t,0,5)'[vwm]",
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

  test('HEVC to H264 transcode', () => {
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'hevc',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.FHD,
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
      }),
    );

    const builder = new SoftwarePipelineBuilder(
      video,
      null,
      null,
      null,
      null,
      EmptyFfmpegCapabilities,
    );

    const out = builder.build(
      makeDefaultFfmpegState(),
      new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
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
        "-c:v",
        "hevc",
        "-readrate",
        "1",
        "-i",
        "/path/to/video.mkv",
        "-map",
        "0:0",
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
});
