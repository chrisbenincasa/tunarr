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

    // this.ffmpegName = isConcatPlaylist ? 'Concat FFMPEG' : 'Stream FFMPEG';

    this.#processHandle.on('error', (error) => {
      this.#logger.error(error, `${this.ffmpegName} received error event`);
    });

    this.#processHandle.on('close', () => {
      this.#running = false;
    });

    this.#processHandle.on('exit', (code, signal) => {
      this.#logger.info(
        `${this.ffmpegName} exited. (signal=%s, code=%d)`,
        signal,
        code,
      );
      if (code === null) {
        if (!this.#processKilled) {
          this.#logger.info(
            `${this.ffmpegName} exited due to signal: ${signal}`,
            {
              cmd: `${this.ffmpegPath} ${this.ffmpegArgs.join(' ')}`,
            },
          );
        } else {
          this.#logger.info(
            `${this.ffmpegName} exited due to signal: ${signal} as expected.`,
          );
        }
        this.emit('close', undefined);
      } else if (code === 0) {
        this.#logger.info(`${this.ffmpegName} exited normally.`);
        this.emit('end');
      } else if (code === 255) {
        if (this.#processHandle) {
          this.#logger.info(`${this.ffmpegName} finished with code 255.`);
          this.emit('close', code);
          return;
        }
        if (!this.#sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.ffmpegPath} ${this.ffmpegArgs.join(' ')}`,
          });
        }
        this.#logger.info(`${this.ffmpegName} exited with code 255.`);
        this.emit('close', code);
      } else {
        this.#logger.info(`${this.ffmpegName} exited with code ${code}.`);
        this.emit('error', {
          code: code,
          cmd: `${this.ffmpegPath} ${this.ffmpegArgs.join(' ')}`,
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
    this.#logger.debug(`${this.ffmpegName} RECEIVED kill() command`);
    this.#processKilled = true;

    if (this.#processHandle.killed || !this.#running) {
      this.#logger.debug(`${this.ffmpegName} already killed.`);
      return;
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
}
