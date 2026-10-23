import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import { Result } from '@/types/result.js';
import { isNonEmptyString } from '@/util/index.js';
import { NewLineTransformStream } from '@/util/streams.js';
import { spawn } from 'node:child_process';
import { Writable } from 'node:stream';

// Used when ffprobe reports no duration for a packet, so the next program
// still starts after it.
const UnknownPacketDurationTicks = 10_000;

/**
 * When each kind of stream in a segment ends, as the latest `pts + duration`
 * of its packets, in the segment's stream time base. Streams end at different
 * times, and audio often runs a few milliseconds past the last video frame.
 */
export type SegmentStreamEnds = {
  audioEnd?: number;
  nonAudioEnd?: number;
};

export class GetSegmentStreamEndsTask {
  constructor(private settingsDB: ISettingsDB) {}

  async run(segmentFilePath: string): Promise<Result<SegmentStreamEnds>> {
    const args = [
      '-v',
      '0',
      '-show_entries',
      'packet=codec_type,pts,duration',
      '-of',
      'compact=p=0:nk=1',
      segmentFilePath,
    ];

    const proc = spawn(this.settingsDB.ffprobePath, args, {
      stdio: ['ignore', 'pipe', process.stderr],
    });

    const lines: string[] = [];
    proc.stdout.pipe(new NewLineTransformStream()).pipe(
      new Writable({
        write(chunk, _, callback) {
          if (chunk instanceof Buffer) {
            const str = chunk.toString('utf-8').trim();
            if (isNonEmptyString(str)) {
              lines.push(str);
            }
          }
          callback();
        },
      }),
    );

    return new Promise((resolve, reject) => {
      proc.on('error', reject);
      proc.on('close', () => {
        resolve(Result.attempt(() => parseSegmentStreamEnds(lines)));
      });
    });
  }
}

/**
 * Parses ffprobe `codec_type|pts|duration` packet lines.
 */
export function parseSegmentStreamEnds(lines: string[]): SegmentStreamEnds {
  const ends: SegmentStreamEnds = {};
  for (const line of lines) {
    const [codecType, pts, duration] = line.split('|', 3);
    const ptsParsed = parseFloat(pts ?? '');
    if (isNaN(ptsParsed)) {
      continue;
    }

    const durationParsed = parseFloat(duration ?? '');
    const end =
      ptsParsed +
      (isNaN(durationParsed) ? UnknownPacketDurationTicks : durationParsed);

    if (codecType === 'audio') {
      ends.audioEnd = Math.max(ends.audioEnd ?? end, end);
    } else {
      ends.nonAudioEnd = Math.max(ends.nonAudioEnd ?? end, end);
    }
  }

  if (ends.audioEnd === undefined && ends.nonAudioEnd === undefined) {
    throw new Error(
      `No packet with a PTS found: last line was ${lines.at(-1) ?? '<none>'}`,
    );
  }

  return ends;
}
