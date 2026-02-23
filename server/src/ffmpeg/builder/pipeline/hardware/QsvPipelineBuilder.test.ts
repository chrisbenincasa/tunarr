import { FileStreamSource } from '../../../../stream/types.ts';
import { TUNARR_ENV_VARS } from '../../../../util/env.ts';
import { EmptyFfmpegCapabilities } from '../../capabilities/FfmpegCapabilities.ts';
import {
  VaapiEntrypoint,
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
  VaapiProfiles,
} from '../../capabilities/VaapiHardwareCapabilities.ts';
import {
  ColorPrimaries,
  ColorRanges,
  ColorSpaces,
  ColorTransferFormats,
} from '../../constants.ts';
import { HardwareUploadQsvFilter } from '../../filter/qsv/HardwareUploadQsvFilter.ts';
import { TonemapQsvFilter } from '../../filter/qsv/TonemapQsvFilter.ts';
import { TonemapFilter } from '../../filter/TonemapFilter.ts';
import { ColorFormat } from '../../format/ColorFormat.ts';
import {
  PixelFormatYuv420P,
  PixelFormatYuv420P10Le,
} from '../../format/PixelFormat.ts';
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

describe('QsvPipelineBuilder', () => {
  test('should work', () => {
    const capabilities = new VaapiHardwareCapabilities([]);
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: ColorFormat.unknown,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new QsvPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

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

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, decoding disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: ColorFormat.unknown,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new QsvPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareDecoding: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, encoding disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: ColorFormat.unknown,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 0,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new QsvPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      null,
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareEncoding: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  test('should work, filters disabled', () => {
    const capabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
    ]);
    const video = VideoInputSource.withStream(
      new FileStreamSource('/path/to/video.mkv'),
      VideoStream.create({
        codec: 'h264',
        profile: 'main',
        displayAspectRatio: '16:9',
        frameSize: FrameSize.withDimensions(1920, 900),
        index: 0,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
        colorFormat: ColorFormat.unknown,
      }),
    );

    const watermark = new WatermarkInputSource(
      new FileStreamSource('/path/to/watermark.jpg'),
      StillImageStream.create({
        frameSize: FrameSize.withDimensions(800, 600),
        index: 0,
      }),
      {
        duration: 5,
        enabled: true,
        horizontalMargin: 5,
        opacity: 100,
        position: 'bottom-right',
        verticalMargin: 5,
        width: 10,
      },
    );

    const builder = new QsvPipelineBuilder(
      capabilities,
      EmptyFfmpegCapabilities,
      video,
      null,
      null,
      watermark,
      new SubtitlesInputSource(
        new FileStreamSource('/path/to/video.mkv'),
        [new EmbeddedSubtitleStream('pgs', 5, SubtitleMethods.Burn)],
        SubtitleMethods.Burn,
      ),
    );

    const state = FfmpegState.create({
      version: {
        versionString: 'n7.0.2-15-g0458a86656-20240904',
        majorVersion: 7,
        minorVersion: 0,
        patchVersion: 2,
        isUnknown: false,
      },
      // start: +dayjs.duration(0),
    });

    const out = builder.build(
      state,
      new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0].squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        videoFormat: 'h264',
      }),
      { ...DefaultPipelineOptions, disableHardwareFilters: true },
    );

    console.log(out.getCommandArgs().join(' '));
  });

  describe('tonemapping', () => {
    const ffmpegVersion = {
      versionString: 'n7.0.2-15-g0458a86656-20240904',
      majorVersion: 7,
      minorVersion: 0,
      patchVersion: 2,
      isUnknown: false,
    } as const;

    const hdrColorFormat = new ColorFormat({
      colorRange: ColorRanges.Tv,
      colorSpace: ColorSpaces.Bt2020nc,
      colorTransfer: ColorTransferFormats.Smpte2084,
      colorPrimaries: ColorPrimaries.Bt2020,
    });

    const fullCapabilities = new VaapiHardwareCapabilities([
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.H264Main,
        VaapiEntrypoint.Encode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.HevcMain10,
        VaapiEntrypoint.Decode,
      ),
      new VaapiProfileEntrypoint(
        VaapiProfiles.HevcMain10,
        VaapiEntrypoint.Encode,
      ),
    ]);

    afterEach(() => {
      vi.unstubAllEnvs();
    });

    function makeH264VideoInput() {
      return VideoInputSource.withStream(
        new FileStreamSource('/path/to/video.mkv'),
        VideoStream.create({
          codec: 'h264',
          profile: 'main',
          displayAspectRatio: '16:9',
          frameSize: FrameSize.FHD,
          index: 0,
          pixelFormat: new PixelFormatYuv420P(),
          providedSampleAspectRatio: null,
          colorFormat: ColorFormat.unknown,
        }),
      );
    }

    function makeHevc10BitVideoInput() {
      return VideoInputSource.withStream(
        new FileStreamSource('/path/to/hdr-video.mkv'),
        VideoStream.create({
          codec: 'hevc',
          displayAspectRatio: '16:9',
          frameSize: FrameSize.FHD,
          index: 0,
          pixelFormat: new PixelFormatYuv420P10Le(),
          providedSampleAspectRatio: null,
          colorFormat: hdrColorFormat,
          profile: 'main 10',
        }),
      );
    }

    function makeDesiredFrameState(video: VideoInputSource) {
      return new FrameState({
        isAnamorphic: false,
        scaledSize: video.streams[0]!.squarePixelFrameSize(FrameSize.FHD),
        paddedSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
      });
    }

    test('does not apply tonemap when TUNARR_TONEMAP_ENABLED is not set', () => {
      const video = makeH264VideoInput();

      const builder = new QsvPipelineBuilder(
        fullCapabilities,
        EmptyFfmpegCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      const tonemapFilter = out
        .getComplexFilter()
        ?.filterChain.videoFilterSteps.find(
          (step) => step instanceof TonemapQsvFilter,
        );

      expect(tonemapFilter).toBeUndefined();
    });

    test('applies TonemapQsvFilter when tonemap is enabled and frame is already on hardware', () => {
      vi.stubEnv(TUNARR_ENV_VARS.TONEMAP_ENABLED, 'true');

      const video = makeHevc10BitVideoInput();

      const builder = new QsvPipelineBuilder(
        fullCapabilities,
        EmptyFfmpegCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        DefaultPipelineOptions,
      );

      const videoFilterSteps =
        out.getComplexFilter()?.filterChain.videoFilterSteps ?? [];

      const tonemapIdx = videoFilterSteps.findIndex(
        (step) => step instanceof TonemapQsvFilter,
      );
      expect(tonemapIdx).toBeGreaterThan(-1);

      // No hwupload should appear before the tonemap filter since the frame is
      // already on hardware from the QSV decoder
      const hwUploadBeforeTonemap = videoFilterSteps
        .slice(0, tonemapIdx)
        .some((step) => step instanceof HardwareUploadQsvFilter);
      expect(hwUploadBeforeTonemap, out.getCommandArgs().join(' ')).toBe(false);
    });

    test('uploads to hardware before applying TonemapQsvFilter when frame is on software', () => {
      vi.stubEnv(TUNARR_ENV_VARS.TONEMAP_ENABLED, 'true');

      // 10-bit HEVC: hardware decode is blocked for 10-bit content, so the
      // frame remains on software when setTonemap is called
      const video = makeHevc10BitVideoInput();

      const builder = new QsvPipelineBuilder(
        fullCapabilities,
        EmptyFfmpegCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        { ...DefaultPipelineOptions, disableHardwareDecoding: true },
      );

      const videoFilterSteps =
        out.getComplexFilter()?.filterChain.videoFilterSteps ?? [];

      const tonemapIdx = videoFilterSteps.findIndex(
        (step) => step instanceof TonemapQsvFilter,
      );
      expect(tonemapIdx).toBeGreaterThan(-1);

      const hwUploadIdx = videoFilterSteps.findIndex(
        (step) => step instanceof HardwareUploadQsvFilter,
      );
      expect(hwUploadIdx).toBeGreaterThan(-1);

      // hwupload must precede tonemap
      expect(hwUploadIdx).toBeLessThan(tonemapIdx);
      expect(
        (videoFilterSteps[hwUploadIdx] as HardwareUploadQsvFilter).filter,
      ).toBe('hwupload=extra_hw_frames=64');
    });

    test('downloads hardware frame and falls back to software tonemap when disableHardwareFilters is true', () => {
      vi.stubEnv(TUNARR_ENV_VARS.TONEMAP_ENABLED, 'true');

      // H264 8-bit: hardware decode still runs (disableHardwareFilters does not
      // affect decoding), so the frame is on hardware when setTonemap is called
      const video = makeHevc10BitVideoInput();

      const builder = new QsvPipelineBuilder(
        fullCapabilities,
        EmptyFfmpegCapabilities,
        video,
        null,
        null,
        null,
        null,
      );

      const out = builder.build(
        FfmpegState.create({ version: ffmpegVersion }),
        makeDesiredFrameState(video),
        { ...DefaultPipelineOptions, disableHardwareFilters: true },
      );

      const videoFilterSteps =
        out.getComplexFilter()?.filterChain.videoFilterSteps ?? [];

      // Hardware tonemap should NOT be applied when hardware filters are disabled
      const tonemapFilter = videoFilterSteps.find(
        (step) => step instanceof TonemapQsvFilter,
      );
      expect(tonemapFilter).toBeUndefined();

      const softwareTonemapFilter = videoFilterSteps.find(
        (step) => step instanceof TonemapFilter,
      );
      expect(softwareTonemapFilter).toBeDefined();
    });
  });
});
