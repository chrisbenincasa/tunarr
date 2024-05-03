import { VideoStream } from '../MediaStream';
import { VideoFormats } from '../constants';
import { CopyVideoEncoder } from './CopyEncoders';
import { VideoEncoder } from './BaseEncoder';
import {
  ImplicitVideoEncoder,
  Libx264Encoder,
  Libx265Encoder,
  Mpeg2VideoEncoder,
} from './SoftwareVideoEncoders';
import { Nullable } from '../../../types/util';
import { NvidiaH264Encoder, NvidiaHevcEncoder } from './nvidia/NvidiaEncoders';
import {
  H264QsvEncoder,
  HevcQsvEncoder,
  Mpeg2QsvEncoder,
} from './qsv/QsvEncoders';

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

  static getNvidiaEncoder(videoStream: VideoStream): Nullable<VideoEncoder> {
    switch (videoStream.codec) {
      case VideoFormats.Hevc:
        return NvidiaHevcEncoder.create();
      case VideoFormats.H264:
        return NvidiaH264Encoder.create();
      default:
        return null;
    }
  }

  static getQsvEncoder(videoStream: VideoStream): Nullable<VideoEncoder> {
    switch (videoStream.codec) {
      case VideoFormats.Hevc:
        return HevcQsvEncoder.create();
      case VideoFormats.H264:
        return H264QsvEncoder.create();
      case VideoFormats.Mpeg2Video:
        return Mpeg2QsvEncoder.create();
      default:
        return null;
    }
  }
}
