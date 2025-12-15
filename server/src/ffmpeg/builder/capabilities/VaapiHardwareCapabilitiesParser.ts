import { RateControlMode } from '@/ffmpeg/builder/types.js';
import { isEmpty, split } from 'lodash-es';
import {
  VaapiHardwareCapabilities,
  VaapiProfileEntrypoint,
} from './VaapiHardwareCapabilities.ts';

export class VaapiHardwareCapabilitiesParser {
  private static ProfileEntrypointPattern = /(VAProfile\w*).*(VAEntrypoint\w*)/;
  private static ProfileRateControlPattern = /.*VA_RC_(\w*).*/;

  static extractEntrypointsFromVaInfo(result: string) {
    const entrypoints: VaapiProfileEntrypoint[] = [];
    for (const line of split(result, '\n')) {
      const match = line.match(this.ProfileEntrypointPattern);
      if (match) {
        entrypoints.push(new VaapiProfileEntrypoint(match[1]!, match[2]!));
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
        currentEntrypoint = new VaapiProfileEntrypoint(match[1]!, match[2]!);
        entrypoints.push(currentEntrypoint);
      } else if (currentEntrypoint) {
        match = line.match(this.ProfileRateControlPattern);
        if (match) {
          switch (match[0]?.trim().toLowerCase()) {
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
