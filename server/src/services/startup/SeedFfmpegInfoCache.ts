import { inject, injectable } from 'inversify';
import { ISettingsDB } from '../../db/interfaces/ISettingsDB.ts';
import { FfmpegInfo } from '../../ffmpeg/ffmpegInfo.ts';
import { KEYS } from '../../types/inject.ts';
import { fileExists } from '../../util/fsUtil.ts';
import { Logger } from '../../util/logging/LoggerFactory.ts';
import { SimpleStartupTask } from './IStartupTask.ts';

@injectable()
export class SeedFfmpegInfoCache extends SimpleStartupTask {
  id = SeedFfmpegInfoCache.name;
  dependencies: string[] = [];

  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
    @inject(FfmpegInfo) private ffmpegInfo: FfmpegInfo,
  ) {
    super();
  }

  async getPromise(): Promise<void> {
    if (
      await fileExists(this.settingsDB.ffmpegSettings().ffmpegExecutablePath)
    ) {
      this.ffmpegInfo
        .seed()
        .then(() => {
          this.logger.debug('Successfully seeded ffmpeg info cache.');
        })
        .catch((e) => {
          this.logger.error(e, 'Error while seeing ffmpeg info cache.');
        });
    }
  }
}
