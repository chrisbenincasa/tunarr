import { seq } from '@tunarr/shared/util';
import { drop, isEmpty, map, reject, split, trim } from 'lodash-es';
import type { ReadableFfmpegSettings } from '../../../db/interfaces/ISettingsDB.ts';
import type { TranscodeConfig } from '../../../db/schema/TranscodeConfig.ts';
import { ChildProcessHelper } from '../../../util/ChildProcessHelper.ts';
import { LoggerFactory } from '../../../util/logging/LoggerFactory.ts';
import { FFmpegOptionsExtractionPattern } from '../../ffmpegInfo.ts';
import type {
  BaseFfmpegHardwareCapabilities,
  FfmpegHardwareCapabilitiesFactory,
} from './BaseFfmpegHardwareCapabilities.ts';
import { DefaultHardwareCapabilities } from './DefaultHardwareCapabilities.ts';
import { QsvHardwareCapabilities } from './QsvHardwareCapabilities.ts';
import { VaapiHardwareCapabilitiesFactory } from './VaapiHardwareCapabilitiesFactory.ts';

export class QsvHardwareCapabilitiesFactory
  implements FfmpegHardwareCapabilitiesFactory
{
  private logger = LoggerFactory.child({
    className: QsvHardwareCapabilitiesFactory.name,
  });

  constructor(
    private transcodeConfig: TranscodeConfig,
    private ffmpegSettings: ReadableFfmpegSettings,
  ) {}

  async getCapabilities(): Promise<BaseFfmpegHardwareCapabilities> {
    try {
      const [underlyingCapabilities, decoderOptions] = await Promise.all([
        new VaapiHardwareCapabilitiesFactory(
          this.transcodeConfig,
        ).getCapabilities(),
        this.getDecoderOptions(),
      ]);

      return new QsvHardwareCapabilities(
        underlyingCapabilities,
        decoderOptions,
      );
    } catch (e) {
      this.logger.error(
        e,
        'Error while attempting to construct QSV hardware capabilities!',
      );
      return new DefaultHardwareCapabilities();
    }
  }

  private async getDecoderOptions() {
    const output = await new ChildProcessHelper().getStdout(
      this.ffmpegSettings.ffmpegExecutablePath,
      ['-hide_banner', '-help', 'decoder=h264_qsv'],
    );

    const nonEmptyLines = reject(map(drop(split(output, '\n'), 1), trim), (s) =>
      isEmpty(s),
    );

    return seq.collect(nonEmptyLines, (line) => {
      return line.match(FFmpegOptionsExtractionPattern)?.[1];
    });
  }
}
