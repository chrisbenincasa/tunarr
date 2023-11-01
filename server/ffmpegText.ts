import { ChildProcessWithoutNullStreams, spawn } from 'child_process';
import events from 'events';
import { globalOptions } from './globals.js';

export class FFMPEG_TEXT extends events.EventEmitter {
  private args: string[];
  private ffmpeg: ChildProcessWithoutNullStreams;

  constructor(opts, title, subtitle) {
    super();
    this.args = [
      '-threads',
      opts.threads,
      '-f',
      'lavfi',
      '-re',
      '-stream_loop',
      '-1',
      '-i',
      `color=c=black:s=${opts.videoResolution}`,
      '-f',
      'lavfi',
      '-i',
      'anullsrc',
      '-vf',
      `drawtext=fontfile=${
        globalOptions().database
      }/font.ttf:fontsize=30:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:text='${title}',drawtext=fontfile=${
        globalOptions().database
      }/font.ttf:fontsize=20:fontcolor=white:x=(w-text_w)/2:y=(h+text_h+20)/2:text='${subtitle}'`,
      '-c:v',
      opts.videoEncoder,
      '-c:a',
      opts.audioEncoder,
      '-f',
      'mpegts',
      'pipe:1',
    ];

    this.ffmpeg = spawn(opts.ffmpegPath, this.args);

    this.ffmpeg.stdout.on('data', (chunk) => {
      this.emit('data', chunk);
    });

    if (opts.logFfmpeg) {
      this.ffmpeg.stderr.on('data', (chunk) => {
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
          cmd: `${opts.ffmpegPath} ${this.args.join(' ')}`,
        });
    });
  }
  kill() {
    this.ffmpeg.kill();
  }
}
