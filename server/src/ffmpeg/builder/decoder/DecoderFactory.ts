import { VideoStream } from '../MediaStream';
import { VideoFormats } from '../constants';
import { HardwareAccelerationMode } from '../types';
import { H264Decoder, ImplicitDecoder } from './SoftwareDecoder';
import { NvidiaH264Decoder } from './nvidia/NvidiaDecoders';

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
}
