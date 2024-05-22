import { FfmpegSettings } from '@tunarr/types';
import { exec } from 'child_process';
import { LoggerFactory } from '../util/logging/LoggerFactory';
import { Mutex } from 'async-mutex';
import NodeCache from 'node-cache';
import { isNull } from 'lodash-es';

const versionMutex = new Mutex();
const versionCacheByPath = new NodeCache({ stdTTL: 60 * 5 });
export class FFMPEGInfo {
  private logger = LoggerFactory.child({ caller: import.meta });
  private ffmpegPath: string;

  constructor(opts: FfmpegSettings) {
    this.ffmpegPath = opts.ffmpegExecutablePath;
  }

  async getVersion() {
    const cachedValue = versionCacheByPath.get<string>(this.ffmpegPath);
    if (cachedValue) {
      return cachedValue;
    }

    return await versionMutex.runExclusive(async () => {
      try {
        const s: string = await new Promise((resolve, reject) => {
          exec(
            `"${this.ffmpegPath}" -hide_banner -version`,
            function (error, stdout) {
              if (error !== null) {
                reject(error);
              } else {
                resolve(stdout);
              }
            },
          );
        });
        const m = s.match(/version\s+([^\s]+)\s+.*Copyright/);

        if (isNull(m) || m.length < 2) {
          this.logger.error(
            'ffmpeg -version command output not in the expected format: ' + s,
          );
          return s;
        }

        versionCacheByPath.set(this.ffmpegPath, m[1]);
        return m[1];
      } catch (err) {
        this.logger.error(err);
        return 'unknown';
      }
    });
  }
}
