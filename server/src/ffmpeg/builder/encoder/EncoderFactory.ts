import { VideoStream } from '../MediaStream';
import { VideoFormats } from '../constants';
import { CopyVideoEncoder } from './CopyEncoders';
import { VideoEncoder } from './BaseEncoder';
import {
  ImplicitVideoEncoder,
  Libx264Encoder,
  Libx265Encoder,
  Mpeg2VideoEncoder,
} from './VideoEncoders';

export class EncoderFactory {
  static getSoftwareEncoder(videoStream: VideoStream): VideoEncoder {
    switch (videoStream.codec) {
      case VideoFormats.Hevc:
        return Libx265Encoder.create();
      case VideoFormats.H264:
        return Libx264Encoder.create();
      case VideoFormats.Mpeg2Video:
        return Mpeg2VideoEncoder.create();
      case VideoFormats.Copy:
        return CopyVideoEncoder.create();
      default:
        return ImplicitVideoEncoder.create();
    }
  }
}
