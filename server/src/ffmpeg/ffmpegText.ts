import { globalOptions } from '@/globals.js';
import type { ChildProcessWithoutNullStreams } from 'node:child_process';
import { spawn } from 'node:child_process';
import events from 'node:events';
import type { ReadableFfmpegSettings } from '../db/interfaces/ISettingsDB.ts';
import type { TranscodeConfig } from '../db/schema/TranscodeConfig.ts';

export class FfmpegText extends events.EventEmitter {
  private args: string[];
  private ffmpeg: ChildProcessWithoutNullStreams;

  constructor(
    transcodeConfig: TranscodeConfig,
    opts: ReadableFfmpegSettings,
    title: string,
    subtitle: string,
  ) {
    super();
    this.args = [
      '-threads',
      transcodeConfig.threadCount.toString(),
      '-f',
      'lavfi',
      '-re',
      '-stream_loop',
      '-1',
      '-i',
      `color=c=black:s=${transcodeConfig.resolution.widthPx}x${transcodeConfig.resolution.heightPx}`, // this is wrong, figure out the param
      '-f',
      'lavfi',
      '-i',
      'anullsrc',
      '-vf',
      `drawtext=fontfile=${
        globalOptions().databaseDirectory
      }/font.ttf:fontsize=30:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${title}',drawtext=fontfile=${
        globalOptions().databaseDirectory
      }/font.ttf:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+20)/2:text='${subtitle}'`,
      '-c:v',
      transcodeConfig.videoFormat,
      '-c:a',
      transcodeConfig.audioFormat,
      '-f',
      'mpegts',
      'pipe:1',
    ];

    this.ffmpeg = spawn(opts.ffmpegExecutablePath, this.args);

    this.ffmpeg.stdout.on('data', (chunk) => {
      this.emit('data', chunk);
    });

    if (opts.enableLogging) {
      this.ffmpeg.stderr.on('data', (chunk: Buffer) => {
        process.stderr.write(chunk);
      });
    }

    this.ffmpeg.on('close', (code) => {
      if (code === null) this.emit('close', code);
      else if (code === 0) this.emit('close', code);
      else if (code === 255) this.emit('close', code);
      else
        this.emit('error', {
          code: code,
          cmd: `${opts.ffmpegExecutablePath} ${this.args.join(' ')}`,
        });
    });
  }
  kill() {
    this.ffmpeg.kill();
  }
}
