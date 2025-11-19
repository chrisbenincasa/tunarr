import { first } from 'lodash-es';
import { HardwareAccelerationMode } from '../../../../db/schema/TranscodeConfig.ts';
import { FileStreamSource } from '../../../../stream/types.ts';
import { FilterChain } from '../../filter/FilterChain.ts';
import { HardwareUploadCudaFilter } from '../../filter/nvidia/HardwareUploadCudaFilter.ts';
import { ScaleCudaFilter } from '../../filter/nvidia/ScaleCudaFilter.ts';
import { ScaleFilter } from '../../filter/ScaleFilter.ts';
import { PixelFormatYuv420P } from '../../format/PixelFormat.ts';
import { VideoInputSource } from '../../input/VideoInputSource.ts';
import { StillImageStream, VideoStream } from '../../MediaStream.ts';
import {
  DefaultPipelineOptions,
  FfmpegState,
} from '../../state/FfmpegState.ts';
import { FrameState } from '../../state/FrameState.ts';
import { FrameDataLocation, FrameSize } from '../../types.ts';
import { PipelineBuilderContext } from '../BasePipelineBuilder.ts';
import { NvidiaScaler } from './NvidiaScaler.ts';

describe('NvidiaScaler', () => {
  test('current = desired state, no-op', () => {
    const stream = new FileStreamSource('/path/to/video.mkv');
    const videoInputSource = VideoInputSource.withStream(
      stream,
      VideoStream.create({
        codec: 'h264',
        index: 0,
        displayAspectRatio: '16:9',
        frameSize: FrameSize.FHD,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
      }),
    );

    const context = new PipelineBuilderContext({
      desiredState: new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
      }),
      filterChain: new FilterChain(),
      is10BitOutput: false,
      isIntelVaapiOrQsv: false,
      hasWatermark: false,
      videoStream: videoInputSource.streams[0],
      ffmpegState: FfmpegState.create({
        version: { versionString: '7.0.1', isUnknown: false },
      }),
      shouldDeinterlace: false,
      pipelineSteps: [],
      pipelineOptions: DefaultPipelineOptions,
    });

    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.FHD,
      paddedSize: FrameSize.FHD,
    });

    const nextState = NvidiaScaler.setScale(
      context,
      videoInputSource,
      currentState,
    );

    expect(nextState).toStrictEqual(currentState);
  });

  test('uses software scale when necessary', () => {
    const stream = new FileStreamSource('/path/to/video.mkv');
    const videoInputSource = VideoInputSource.withStream(
      stream,
      VideoStream.create({
        codec: 'h264',
        index: 0,
        displayAspectRatio: '16:9',
        frameSize: FrameSize.SevenTwenty,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
      }),
    );

    const context = new PipelineBuilderContext({
      desiredState: new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
      }),
      filterChain: new FilterChain(),
      is10BitOutput: false,
      isIntelVaapiOrQsv: false,
      hasWatermark: false,
      videoStream: videoInputSource.streams[0],
      ffmpegState: FfmpegState.create({
        version: { versionString: '7.0.1', isUnknown: false },
      }),
      shouldDeinterlace: false,
      pipelineSteps: [],
      pipelineOptions: DefaultPipelineOptions,
    });

    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.SevenTwenty,
      paddedSize: FrameSize.FHD,
    });

    const nextState = NvidiaScaler.setScale(
      context,
      videoInputSource,
      currentState,
    );

    const scaleStep = first(videoInputSource.filterSteps);
    expect(scaleStep).toBeDefined();
    expect(scaleStep).toBeInstanceOf(ScaleFilter);
    expect(scaleStep?.filter).toEqual(
      'scale=1920:1080:flags=fast_bilinear,setsar=1',
    );
    expect(nextState).toStrictEqual(
      currentState.update({
        scaledSize: FrameSize.FHD,
      }),
    );
  });

  test('uses hardware scale when necessary, no out format', () => {
    const stream = new FileStreamSource('/path/to/video.mkv');
    const videoInputSource = VideoInputSource.withStream(
      stream,
      VideoStream.create({
        codec: 'h264',
        index: 0,
        displayAspectRatio: '16:9',
        frameSize: FrameSize.SevenTwenty,
        pixelFormat: new PixelFormatYuv420P(),
        providedSampleAspectRatio: null,
      }),
    );

    const context = new PipelineBuilderContext({
      desiredState: new FrameState({
        isAnamorphic: false,
        scaledSize: FrameSize.FHD,
        paddedSize: FrameSize.FHD,
      }),
      filterChain: new FilterChain(),
      is10BitOutput: false,
      isIntelVaapiOrQsv: false,
      hasWatermark: false,
      videoStream: videoInputSource.streams[0],
      ffmpegState: FfmpegState.create({
        version: { versionString: '7.0.1', isUnknown: false },
        decoderHwAccelMode: HardwareAccelerationMode.Cuda,
        encoderHwAccelMode: HardwareAccelerationMode.Cuda,
      }),
      shouldDeinterlace: false,
      pipelineSteps: [],
      pipelineOptions: DefaultPipelineOptions,
    });

    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.SevenTwenty,
      paddedSize: FrameSize.FHD,
      frameDataLocation: FrameDataLocation.Hardware,
    });

    const nextState = NvidiaScaler.setScale(
      context,
      videoInputSource,
      currentState,
    );

    const scaleStep = first(videoInputSource.filterSteps);
    expect(scaleStep).toBeDefined();
    expect(scaleStep).toBeInstanceOf(ScaleCudaFilter);
    expect(scaleStep?.filter).toEqual('scale_cuda=1920:1080,setsar=1');
    expect(nextState).toStrictEqual(
      currentState.update({
        scaledSize: FrameSize.FHD,
      }),
    );
  });

  test('adds hwupload if necessary before hardware scale', () => {
    const stream = new FileStreamSource('/path/to/video.mkv');
    const videoInputSource = VideoInputSource.withStream(
      stream,
      StillImageStream.create({
        index: 0,
        frameSize: FrameSize.FHD,
      }),
    );

    const context = new PipelineBuilderContext({
      desiredState: new FrameState({
        isAnamorphic: false,
        scaledSize: videoInputSource.streams[0].squarePixelFrameSize(
          FrameSize.SVGA43,
        ),
        paddedSize: FrameSize.SVGA43,
      }),
      filterChain: new FilterChain(),
      is10BitOutput: false,
      isIntelVaapiOrQsv: false,
      hasWatermark: false,
      videoStream: videoInputSource.streams[0],
      ffmpegState: FfmpegState.create({
        version: { versionString: '7.0.1', isUnknown: false },
        decoderHwAccelMode: HardwareAccelerationMode.Cuda,
        encoderHwAccelMode: HardwareAccelerationMode.Cuda,
      }),
      shouldDeinterlace: false,
      pipelineSteps: [],
      pipelineOptions: DefaultPipelineOptions,
    });

    const currentState = new FrameState({
      isAnamorphic: false,
      scaledSize: FrameSize.SevenTwenty,
      paddedSize: FrameSize.FHD,
      frameDataLocation: FrameDataLocation.Software,
    });

    const nextState = NvidiaScaler.setScale(
      context,
      videoInputSource,
      currentState,
    );

    const [hwuploadStep, scaleStep] = videoInputSource.filterSteps;
    expect(hwuploadStep).toBeInstanceOf(HardwareUploadCudaFilter);
    expect(hwuploadStep.filter).toEqual('format=yuv420p,hwupload_cuda');
    expect(scaleStep).toBeInstanceOf(ScaleCudaFilter);
    expect(scaleStep?.filter).toEqual(
      'scale_cuda=800:600:force_original_aspect_ratio=decrease,setsar=1',
    );
    expect(nextState).toStrictEqual(
      currentState.update({
        frameDataLocation: FrameDataLocation.Hardware,
        scaledSize: FrameSize.withDimensions(800, 450),
        paddedSize: FrameSize.withDimensions(800, 450), // Pad not applied yet
      }),
    );
  });
});
