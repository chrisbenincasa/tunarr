import { FfmpegSettings } from '@tunarr/types';
import { FfmpegNumericLogLevels } from '@tunarr/types/schemas';
import { ChildProcessByStdio, spawn } from 'node:child_process';
import events from 'node:events';
import path from 'node:path';
import stream from 'node:stream';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Maybe, Nullable } from '../types/util.js';
import { isDefined } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

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
    private settingsDB: SettingsDB = getSettings(),
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

    const env = {
      ...process.env,
    };

    if (this.ffmpegSettings.enableFileLogging) {
      const normalizedName = this.ffmpegName.toLowerCase().replaceAll(' ', '-');
      const logPath = path.join(
        this.settingsDB.systemSettings().logging.logsDirectory,
        `ffmpeg-report-${normalizedName}-%t.log`,
      );
      env['FFREPORT'] = `file=${logPath}:level=${
        FfmpegNumericLogLevels[this.ffmpegSettings.logLevel]
      }`;
    }

    // const test = createWriteStream('./test.log', { flags: 'a' });
    this.#processHandle = spawn(this.ffmpegPath, this.ffmpegArgs, {
      stdio: ['ignore', 'pipe', 'pipe'],
      env,
    });

    this.#running = true;

    // Pipe to our own stderr if enabled
    if (this.ffmpegSettings.enableLogging) {
      this.#processHandle.stderr.pipe(process.stderr);
    }

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
      const expected =
        (this.#processKilled &&
          (code === null || signal === 'SIGTERM' || signal === 'SIGKILL')) ||
        code === 0;
      this.#logger.info(
        { args: argsWithTokenRedacted },
        `${this.ffmpegName} exited. (signal=%s, code=%d, expected?=%s)`,
        signal,
        code ?? -1,
        expected,
      );

      this.emit('exit', code, signal, expected);

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

export type FfmpegEvents = {
  end: (obj?: { code: number; cmd: string }) => void;
  error: (obj?: { code: number; cmd: string }) => void;
  close: (code?: number) => void;
  // Fired when the process exited, for any reason.
  // expected = true when Tunarr itself issued the end of the process
  exit: (
    code: Nullable<number>,
    signal: Nullable<NodeJS.Signals>,
    expected: boolean,
  ) => void;
};
