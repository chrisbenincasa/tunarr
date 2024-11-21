import { VideoStream } from '@/ffmpeg/builder/MediaStream.ts';
import { VideoFormats } from '@/ffmpeg/builder/constants.ts';
import { HardwareAccelerationMode } from '@/ffmpeg/builder/types.ts';
import {
  H264Decoder,
  HevcDecoder,
  ImplicitDecoder,
  Mpeg2Decoder,
  Mpeg4Decoder,
  RawVideoDecoder,
  Vc1Decoder,
} from './SoftwareDecoder.ts';
import {
  NvidiaH264Decoder,
  NvidiaHevcDecoder,
  NvidiaMpeg2Decoder,
  NvidiaVc1Decoder,
  NvidiaVp9Decoder,
} from './nvidia/NvidiaDecoders.ts';
import {
  H264QsvDecoder,
  HevcQsvDecoder,
  Mpeg2QsvDecoder,
  Vc1QsvDecoder,
  Vp9QsvDecoder,
} from './qsv/QsvDecoders.ts';

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
      default:
        return null;
    }
  }

  static getQsvDecoder(videoStream: VideoStream) {
    switch (videoStream.codec) {
      case VideoFormats.H264:
        return new H264QsvDecoder();
      case VideoFormats.Hevc:
        return new HevcQsvDecoder();
      case VideoFormats.Mpeg2Video:
        return new Mpeg2QsvDecoder();
      case VideoFormats.Vc1:
        return new Vc1QsvDecoder();
      case VideoFormats.Vp9:
        return new Vp9QsvDecoder();
      default:
        return null;
    }
  }
}
