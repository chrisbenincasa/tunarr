import { FfmpegSettings } from '@tunarr/types';
import { exec } from 'child_process';
import { LoggerFactory } from '../util/logging/LoggerFactory';

export class FFMPEGInfo {
  private logger = LoggerFactory.child({ caller: import.meta });

  private ffmpegPath: string;
  constructor(opts: FfmpegSettings) {
    this.ffmpegPath = opts.ffmpegExecutablePath;
  }
  async getVersion() {
    try {
      const s: string = await new Promise((resolve, reject) => {
        exec(`"${this.ffmpegPath}" -version`, function (error, stdout) {
          if (error !== null) {
            reject(error);
          } else {
            resolve(stdout);
          }
        });
      });
      const m = s.match(/version\s+([^\s]+)\s+.*Copyright/);
      if (m == null) {
        this.logger.error(
          'ffmpeg -version command output not in the expected format: ' + s,
        );
        return s;
      }
      return m[1];
    } catch (err) {
      this.logger.error(err);
      return 'unknown';
    }
  }
}
