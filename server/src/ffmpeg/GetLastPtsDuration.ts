import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { Result } from '@/types/result.js';
import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';

export type StreamEndPts = {
  endPts: number;
  audioEndPts?: number;
};

export class GetLastPtsDurationTask {
  constructor(private settingsDB: ISettingsDB) {}

  async run(segmentFilePath: string): Promise<Result<StreamEndPts>> {
    const args = [
      '-v',
      '0',
      '-show_entries',
      'packet=codec_type,pts,duration',
      '-of',
      'compact=p=0',
      segmentFilePath,
    ];

    const proc = spawn(this.settingsDB.ffprobePath, args, {
      stdio: ['ignore', 'pipe', process.stderr],
    });

    let result: Result<StreamEndPts> = Result.success({ endPts: -Infinity });
    const lines = createInterface({ input: proc.stdout, crlfDelay: Infinity });
    lines.on('line', (line) => {
      if (line.trim().length > 0) {
        result = result.map((ends) => accumulateStreamEnd(ends, line));
      }
    });

    return new Promise((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', (code) => {
        if (code !== 0) {
          resolve(Result.failure(`ffprobe exited with code ${code}`));
          return;
        }
        resolve(
          result.map((ends) => {
            if (!Number.isFinite(ends.endPts)) {
              throw new Error('No packet timestamps found in HLS segment');
            }
            return ends;
          }),
        );
      });
    });
  }
}

export function accumulateStreamEnd(
  ends: StreamEndPts,
  line: string,
): StreamEndPts {
  const fields: Record<string, string | undefined> = {};
  for (const field of line.split('|')) {
    const [key, value] = field.split('=', 2);
    if (key) {
      fields[key] = value;
    }
  }
  const pts = Number(fields.pts);
  if (!Number.isFinite(pts)) {
    throw new Error(`PTS was not a number: got ${line}`);
  }
  const duration = Number(fields.duration);
  const endPts = pts + (Number.isFinite(duration) ? duration : 10_000);
  return {
    endPts: Math.max(ends.endPts, endPts),
    audioEndPts:
      fields.codec_type === 'audio'
        ? Math.max(ends.audioEndPts ?? -Infinity, endPts)
        : ends.audioEndPts,
  };
}
