import { Result } from '@/types/result.js';
import { ChildProcessHelper } from '@/util/ChildProcessHelper.js';

// HLS segments are MPEG-TS, which timestamps every stream at 90 kHz.
const MpegTsTicksPerSecond = 90_000;

const ProbeOffsetSeconds = 10;

const ProbeTimeoutMs = 10_000;

// Real encoder delays are tens of milliseconds. Anything this large means the
// probe output was not what we expected.
const MaxPlausibleLeadTicks = MpegTsTicksPerSecond / 5;

export type AudioEncoderLeadOptions = {
  encoder: string;
  sampleRateKhz: number;
  channels: number;
};

/**
 * Measures how far before `-output_ts_offset` an audio encoder places its
 * first packet. Encoders such as AAC prime with a frame of delay samples, so
 * each new program's audio starts this much early and overlaps the previous
 * program's audio unless the offset accounts for it.
 *
 * The result is in 90 kHz ticks.
 */
export class MeasureAudioEncoderLeadTask {
  constructor(private ffmpegPath: string) {}

  async run(opts: AudioEncoderLeadOptions): Promise<Result<number>> {
    const args = [
      '-hide_banner',
      '-nostdin',
      '-v',
      'error',
      '-f',
      'lavfi',
      '-i',
      `anullsrc=r=${opts.sampleRateKhz * 1000}:cl=stereo`,
      '-t',
      '0.2',
      '-c:a',
      opts.encoder,
      '-ac',
      `${opts.channels}`,
      '-ar',
      `${opts.sampleRateKhz}k`,
      '-output_ts_offset',
      `${ProbeOffsetSeconds}`,
      '-f',
      'framecrc',
      'pipe:1',
    ];

    return Result.attemptAsync(async () => {
      const stdout = await new ChildProcessHelper().getStdout(
        this.ffmpegPath,
        args,
        { swallowError: false, timeout: ProbeTimeoutMs },
      );
      return parseEncoderLeadFromFramecrc(stdout, ProbeOffsetSeconds);
    });
  }
}

export function parseEncoderLeadFromFramecrc(
  output: string,
  offsetSeconds: number,
): number {
  let timebase: { num: number; den: number } | undefined;
  for (const line of output.split('\n')) {
    const tb = line.match(/^#tb 0: (\d+)\/(\d+)/);
    if (tb) {
      timebase = { num: Number(tb[1]), den: Number(tb[2]) };
      continue;
    }

    const packet = line.match(/^0,\s*(-?\d+),/);
    if (!packet) {
      continue;
    }

    if (timebase === undefined || timebase.den === 0) {
      throw new Error('framecrc output had a packet before its timebase');
    }

    // Subtract in the stream's own time base, where both values are integers,
    // so rounding up cannot add a tick of floating-point error.
    const offsetInTimebase = (offsetSeconds * timebase.den) / timebase.num;
    const leadInTimebase = offsetInTimebase - Number(packet[1]);
    const leadTicks = Math.ceil(
      (leadInTimebase * timebase.num * MpegTsTicksPerSecond) / timebase.den,
    );
    if (leadTicks < 0 || leadTicks > MaxPlausibleLeadTicks) {
      throw new Error(
        `Implausible audio encoder lead of ${leadTicks} ticks from framecrc line: ${line}`,
      );
    }
    return leadTicks;
  }

  throw new Error('framecrc output had no audio packets');
}
