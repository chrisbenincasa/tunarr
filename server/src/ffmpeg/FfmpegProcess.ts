import { FfmpegSettings } from '@tunarr/types';
import { ChildProcessByStdio, spawn } from 'node:child_process';
import events from 'node:events';
import stream from 'node:stream';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Maybe } from '../types/util.js';
import { isDefined } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { FfmpegEvents } from './ffmpeg.js';

/**
 * Wrapper for an ffmpeg process with the given arguments
 */
export class FfmpegProcess extends (events.EventEmitter as new () => TypedEventEmitter<FfmpegEvents>) {
  #logger = LoggerFactory.child({ className: FfmpegProcess.name });
  #processHandle: ChildProcessByStdio<null, stream.Readable, stream.Readable>;
  #processKilled = false;
  #running = false;
  #sentData = false;

  constructor(
    private ffmpegSettings: FfmpegSettings,
    private ffmpegName: string,
    private ffmpegArgs: string[],
  ) {
    super();
  }

  get initialized() {
    return isDefined(this.#processHandle);
  }

  get stdout() {
    if (!this.initialized) {
      return;
    }
    return this.#processHandle.stdout;
  }

  start(): Maybe<stream.Readable> {
    if (this.initialized) {
      this.#logger.debug(
        'Tried to initialize ffmpeg process twice! Returning original stream.',
      );
      return this.#processHandle.stdout;
    }

    const argsWithTokenRedacted = this.ffmpegArgs
      .join(' ')
      .replaceAll(/(.*X-Plex-Token=)([A-z0-9_\\-]+)(.*)/g, '$1REDACTED$3')
      .replaceAll(/(.*X-Emby-Token:\s)([A-z0-9_\\-]+)(.*)/g, '$1REDACTED$3');

    this.#logger.debug(
      `Starting ffmpeg with args: "%s"`,
      argsWithTokenRedacted,
    );

    // const test = createWriteStream('./test.log', { flags: 'a' });
    this.#processHandle = spawn(this.ffmpegPath, this.ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
    });

    this.#running = true;

    // Pipe to our own stderr if enabled
    if (this.ffmpegSettings.enableLogging) {
      this.#processHandle.stderr.pipe(process.stderr);
    }

    // Hide this behind a 'flag' for now...
    // if (process.env.DEBUG_FFMPEG) {
    //   const ffmpegLogger = createFfmpegProcessLogger(
    //     `${this.channel.uuid}_${this.ffmpegName}`,
    //   );
    //   this.ffmpeg.stderr.on('end', () => ffmpegthis.Logger.close());
    //   this.ffmpeg.stderr.pipe(
    //     new Writable({
    //       write(chunk, _, callback) {
    //         if (chunk instanceof Buffer) {
    //           ffmpegthis.Logger.info(chunk.toString());
    //         }
    //         callback();
    //       },
    //     }),
    //   );
    // }

    if (this.#processKilled) {
      this.#logger.trace('Sending SIGKILL to ffmpeg');
      this.#processHandle.kill('SIGKILL');
      return;
    }

    this.#processHandle.on('error', (error) => {
      this.#logger.error(error, `${this.ffmpegName} received error event`);
    });

    this.#processHandle.on('close', () => {
      this.#running = false;
    });

    this.#processHandle.on('exit', (code, signal) => {
      this.#logger.info(
        { args: argsWithTokenRedacted },
        `${this.ffmpegName} exited. (signal=%s, code=%d, expected?=%s)`,
        signal,
        code ?? -1,
        this.#processKilled && (code === null || signal === 'SIGTERM'),
      );
      this.emit('exit', code, signal);
      if (code === null || signal === 'SIGTERM') {
        this.emit('close', undefined);
      } else if (code === 0) {
        this.emit('end');
      } else if (code === 255) {
        if (this.#processHandle) {
          this.emit('close', code);
          return;
        }
        if (!this.#sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.ffmpegPath} ${argsWithTokenRedacted}`,
          });
        }
        this.emit('close', code);
      } else {
        this.emit('error', {
          code: code,
          cmd: `${this.ffmpegPath} ${argsWithTokenRedacted}`,
        });
      }
    });

    this.#processHandle.stdout.once('data', (d) => {
      if (d) {
        this.#sentData = true;
      }
    });

    return this.#processHandle.stdout;
  }

  kill() {
    this.#processKilled = true;

    if (this.#processHandle.killed || !this.#running) {
      this.#logger.debug(
        `${this.ffmpegName} received kill command but was already killed.`,
      );
      return;
    } else {
      this.#logger.debug(`${this.ffmpegName} received kill command`);
    }

    if (isDefined(this.#processHandle)) {
      this.#logger.debug(`${this.ffmpegName} sending SIGTERM`);
      this.#processHandle?.kill();
      setTimeout(() => {
        if (this.#running) {
          this.#logger.info(
            `${this.ffmpegName} still running after SIGTERM. Sending SIGKILL`,
          );
          this.#processHandle?.kill('SIGKILL');
        }
      }, 15_000);
    }
  }

  get ffmpegPath() {
    return this.ffmpegSettings.ffmpegExecutablePath;
  }

  get args() {
    return this.ffmpegArgs;
  }
}
