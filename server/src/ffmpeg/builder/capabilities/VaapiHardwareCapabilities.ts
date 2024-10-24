import { isEmpty, split } from 'lodash-es';
import { Maybe } from '../../../types/util';
import { LoggerFactory } from '../../../util/logging/LoggerFactory';
import { PixelFormat } from '../format/PixelFormat';
import { RateControlMode } from '../types';
import { BaseFfmpegHardwareCapabilities } from './BaseFfmpegHardwareCapabilities';

export const VaapiEntrypoint = {
  Decode: 'VAEntrypointVLD',
  Encode: 'VAEntrypointEncSlice',
  EncodeLowPower: 'VAEntrypointEncSliceLP',
} as const;

export const VaapiProfiles = {
  Mpeg2Simple: 'VAProfileMPEG2Simple',
  Mpeg2Main: 'VAProfileMPEG2Main',
  H264ConstrainedBaseline: 'VAProfileH264ConstrainedBaseline',
  H264Main: 'VAProfileH264Main',
  H264High: 'VAProfileH264High',
  H264MultiviewHigh: 'VAProfileH264MultiviewHigh',
  H264StereoHigh: 'VAProfileH264StereoHigh',
  Vc1Simple: 'VAProfileVC1Simple',
  Vc1Main: 'VAProfileVC1Main',
  Vc1Advanced: 'VAProfileVC1Advanced',
  HevcMain: 'VAProfileHEVCMain',
  HevcMain10: 'VAProfileHEVCMain10',
  Vp9Profile0: 'VAProfileVP9Profile0',
  Vp9Profile1: 'VAProfileVP9Profile1',
  Vp9Profile2: 'VAProfileVP9Profile2',
  Vp9Profile3: 'VAProfileVP9Profile3',
  Av1Profile0: 'VAProfileAV1Profile0',
} as const;

export class VaapiProfileEntrypoint {
  #rateControlModes: Set<RateControlMode> = new Set();

  constructor(
    public readonly profile: string,
    public readonly entrypoint: string,
  ) {}

  get rateControlModes(): Set<RateControlMode> {
    return this.#rateControlModes;
  }

  addRateControlMode(mode: RateControlMode) {
    this.#rateControlModes.add(mode);
  }
}

export class VaapiHardwareCapabilitiesFactory {
  private static logger = LoggerFactory.child({
    className: this.constructor.name,
  });
  private static ProfileEntrypointPattern =
    /(VAProfile\w*).*(VAEntrypoint\w*)/g;
  private static ProfileRateControlPattern = /.*VA_RC_(\w*).*/g;

  static extractEntrypointsFromVaInfo(result: string) {
    const entrypoints: VaapiProfileEntrypoint[] = [];
    for (const line of split(result, '\n')) {
      const match = line.match(this.ProfileEntrypointPattern);
      if (match) {
        entrypoints.push(new VaapiProfileEntrypoint(match[1], match[2]));
      }
    }

    return entrypoints;
  }

  static extractAllFromVaInfo(result: string) {
    const entrypoints: VaapiProfileEntrypoint[] = [];
    let currentEntrypoint: VaapiProfileEntrypoint | null = null;

    for (const line of split(result, '\n')) {
      let match = line.match(this.ProfileEntrypointPattern);
      if (match) {
        currentEntrypoint = new VaapiProfileEntrypoint(match[1], match[2]);
        entrypoints.push(currentEntrypoint);
      } else if (currentEntrypoint) {
        match = line.match(this.ProfileRateControlPattern);
        if (match) {
          switch (match[1].trim().toLowerCase()) {
            case 'cgp':
              currentEntrypoint.addRateControlMode(RateControlMode.CQP);
              break;
            case 'cbr':
              currentEntrypoint.addRateControlMode(RateControlMode.CBR);
              break;
            case 'vbr':
              currentEntrypoint.addRateControlMode(RateControlMode.VBR);
              break;
            default:
              break;
          }
        }
      }
    }

    if (isEmpty(entrypoints)) {
      return null;
    }

    return new VaapiHardwareCapabilities(entrypoints);
  }
}

export class VaapiHardwareCapabilities extends BaseFfmpegHardwareCapabilities {
  readonly type: string = 'vaapi';

  constructor(private entrypoints: VaapiProfileEntrypoint[]) {
    super();
  }

  canDecode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean> {}

  canEncode(
    videoFormat: string,
    videoProfile: Maybe<string>,
    pixelFormat: Maybe<PixelFormat>,
  ): Promise<boolean> {}
}
