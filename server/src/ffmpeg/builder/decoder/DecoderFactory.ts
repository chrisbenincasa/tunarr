import { VideoStream } from '../MediaStream';
import { VideoFormats } from '../constants';
import { HardwareAccelerationMode } from '../types';
import { H264Decoder, ImplicitDecoder } from './SoftwareDecoder';
import { NvidiaH264Decoder } from './nvidia/NvidiaDecoders';
import {
  H264QsvDecoder,
  HevcQsvDecoder,
  Mpeg2QsvDecoder,
  Vc1QsvDecoder,
  Vp9QsvDecoder,
} from './qsv/QsvDecoders';

export class DecoderFactory {
  static getSoftwareDecoder(videoStream: VideoStream) {
    switch (videoStream.codec) {
      case VideoFormats.H264:
        return new H264Decoder();
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
