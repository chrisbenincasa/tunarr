import { VideoEncoder } from '@/ffmpeg/builder/encoder/BaseEncoder.ts';

export abstract class QsvEncoder extends VideoEncoder {
  protected constructor(name: string) {
    super(name);
  }

  options(): string[] {
    return [...super.options(), '-low_power', '0', '-look_ahead', '0'];
  }
}
