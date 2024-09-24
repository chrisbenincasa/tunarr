import { spawn } from 'child_process';
import { Writable } from 'stream';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { Result } from '../types/result.js';
import { isNonEmptyString } from '../util/index.js';
import { NewLineTransformStream } from '../util/streams.js';

export type PtsAndDuration = {
  pts: number;
  duration: number;
};

export class GetLastPtsDurationTask {
  constructor(private settingsDB: SettingsDB = getSettings()) {}

  async run(segmentFilePath: string): Promise<Result<PtsAndDuration>> {
    const args = [
      '-v',
      '0',
      '-show_entries',
      'packet=pts,duration',
      '-of',
      'compact=p=0:nk=1',
      segmentFilePath,
    ];

    const proc = spawn(this.settingsDB.ffprobePath, args, {
      stdio: ['ignore', 'pipe', process.stderr],
    });

    let lastLine: string = '';
    proc.stdout.pipe(new NewLineTransformStream()).pipe(
      new Writable({
        write(chunk, _, callback) {
          if (chunk instanceof Buffer) {
            const str = chunk.toString('utf-8').trim();
            if (isNonEmptyString(str)) {
              lastLine = str;
            }
          }
          callback();
        },
      }),
    );

    return new Promise((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', () => {
        resolve(Result.attempt(() => parsePtsAndDuration(lastLine)));
      });
    });
  }
}

function parsePtsAndDuration(str: string): PtsAndDuration {
  const [pts, duration] = str.split('|', 2);
  const ptsParsed = parseFloat(pts);
  if (isNaN(ptsParsed)) {
    throw new Error('PTS was not a number');
  }
  let durationParsed = parseFloat(duration);
  if (isNaN(durationParsed)) {
    durationParsed = 10_000;
  }
  return {
    pts: ptsParsed,
    duration: durationParsed,
  };
}
