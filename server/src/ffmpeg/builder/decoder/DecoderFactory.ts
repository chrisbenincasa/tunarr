import type { HardwareAccelerationMode } from '@/db/schema/TranscodeConfig.js';
import type { VideoStream } from '@/ffmpeg/builder/MediaStream.js';
import { VideoFormats } from '@/ffmpeg/builder/constants.js';
import { NvidiaAv1Decoder } from '@/ffmpeg/builder/decoder/nvidia/NvidiaAv1Decoder.js';
import { Av1QsvDecoder } from '@/ffmpeg/builder/decoder/qsv/Av1QsvDecoder.js';
import { BaseFfmpegHardwareCapabilities } from '../capabilities/BaseFfmpegHardwareCapabilities.ts';
import { H264Decoder } from './H264Decoder.ts';
import { HevcDecoder } from './HevcDecoder.ts';
import { ImplicitDecoder } from './ImplicitDecoder.ts';
import { Mpeg2Decoder } from './Mpeg2Decoder.ts';
import { Mpeg4Decoder } from './Mpeg4Decoder.ts';
import { RawVideoDecoder } from './RawVideoDecoder.ts';
import { Vc1Decoder } from './Vc1Decoder.ts';
import { NvidiaH264Decoder } from './nvidia/NvidiaH264Decoder.ts';
import { NvidiaHevcDecoder } from './nvidia/NvidiaHevcDecoder.ts';
import { NvidiaMpeg2Decoder } from './nvidia/NvidiaMpeg2Decoder.ts';
import { NvidiaVc1Decoder } from './nvidia/NvidiaVc1Decoder.ts';
import { NvidiaVp9Decoder } from './nvidia/NvidiaVp9Decoder.ts';
import { H264QsvDecoder } from './qsv/H264QsvDecoder.ts';
import { HevcQsvDecoder } from './qsv/HevcQsvDecoder.ts';
import { Mpeg2QsvDecoder } from './qsv/Mpeg2QsvDecoder.ts';
import { Vc1QsvDecoder } from './qsv/Vc1QsvDecoder.ts';
import { Vp9QsvDecoder } from './qsv/Vp9QsvDecoder.ts';

export class DecoderFactory {
  static getSoftwareDecoder(videoStream: VideoStream) {
    switch (videoStream.codec) {
      case VideoFormats.H264:
        return new H264Decoder();
      case VideoFormats.Hevc:
        return new HevcDecoder();
      case VideoFormats.Vc1:
        return new Vc1Decoder();
      case VideoFormats.Mpeg2Video:
        return new Mpeg2Decoder();
      case VideoFormats.Mpeg4:
        return new Mpeg4Decoder();
      case VideoFormats.Raw:
        return new RawVideoDecoder();
      default:
        return new ImplicitDecoder();
    }
  }

  static getNvidiaDecoder(
    videoStream: VideoStream,
    hardwareAccelerationMode: HardwareAccelerationMode,
  ) {
    switch (videoStream.codec) {
      case VideoFormats.H264:
        return new NvidiaH264Decoder(hardwareAccelerationMode);
      case VideoFormats.Hevc:
        return new NvidiaHevcDecoder(hardwareAccelerationMode);
      case VideoFormats.Mpeg2Video:
        return new NvidiaMpeg2Decoder(
          hardwareAccelerationMode,
          /* TODO */ false,
        );
      case VideoFormats.Vc1:
        return new NvidiaVc1Decoder(hardwareAccelerationMode);
      case VideoFormats.Vp9:
        return new NvidiaVp9Decoder(hardwareAccelerationMode);
      case VideoFormats.Av1:
        return new NvidiaAv1Decoder(hardwareAccelerationMode);
      default:
        return null;
    }
  }

  static getQsvDecoder(
    videoStream: VideoStream,
    hardwareCapabilities: BaseFfmpegHardwareCapabilities,
  ) {
    switch (videoStream.codec) {
      case VideoFormats.H264:
        return new H264QsvDecoder(hardwareCapabilities);
      case VideoFormats.Hevc:
        return new HevcQsvDecoder(hardwareCapabilities);
      case VideoFormats.Mpeg2Video:
        return new Mpeg2QsvDecoder(hardwareCapabilities);
      case VideoFormats.Vc1:
        return new Vc1QsvDecoder(hardwareCapabilities);
      case VideoFormats.Vp9:
        return new Vp9QsvDecoder(hardwareCapabilities);
      case VideoFormats.Av1:
        return new Av1QsvDecoder(hardwareCapabilities);
      default:
        return null;
    }
  }
}
