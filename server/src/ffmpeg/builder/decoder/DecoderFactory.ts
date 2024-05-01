import { VideoStream } from '../MediaStream';
import { VideoFormats } from '../constants';
import { H264Decoder, ImplicitDecoder } from './SoftwareDecoder';

export class DecoderFactory {
  static getSoftwareDecoder(videoStream: VideoStream) {
    switch (videoStream.codec) {
      case VideoFormats.H264:
        return new H264Decoder();
      default:
        return new ImplicitDecoder();
    }
  }
}
