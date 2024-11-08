import { FfmpegSettings } from '@tunarr/types';
import { FfmpegNumericLogLevels } from '@tunarr/types/schemas';
import { isNull, isUndefined } from 'lodash-es';
import { ChildProcessByStdio, exec, spawn } from 'node:child_process';
import events from 'node:events';
import os from 'node:os';
import path from 'node:path';
import stream from 'node:stream';
import { SettingsDB, getSettings } from '../dao/settings.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Maybe, Nullable } from '../types/util.js';
import { isDefined, isWindows } from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';

export type FfmpegEvents = {
  // Emitted when the process ended with a code === 0, i.e. it exited
  // normally and cleanly and finished work.
  end: (obj?: { code: number; cmd: string }) => void;
  // Emitted when the process exited in an error state
  error: (obj?: { code: Nullable<number>; cmd: string }) => void;
  // Fired when the process exited, for any reason.
  // expected = true when Tunarr itself issued the end of the process
  exit: (
    code: Nullable<number>,
    signal: Nullable<NodeJS.Signals>,
    expected: boolean,
  ) => void;
};

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
      .replaceAll(/(X-Plex-Token=)([A-z0-9_\\-]+)/g, '$1REDACTED')
      .replaceAll(/(X-Emby-Token:\s)([A-z0-9_\\-]+)/g, '$1REDACTED');

    this.#logger.debug(
      `Starting ffmpeg with args: "%s"`,
      argsWithTokenRedacted,
    );

    const env = {
      ...process.env,
    };

    if (this.ffmpegSettings.enableFileLogging) {
      const normalizedName = this.ffmpegName.toLowerCase().replaceAll(' ', '-');
      let logPath = path.join(
        this.settingsDB.systemSettings().logging.logsDirectory,
        `ffmpeg-report-${normalizedName}-%t.log`,
      );
      if (os.platform() === 'win32') {
        logPath = logPath.replaceAll('\\', '/').replaceAll(':/', '\\:/');
      }
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
      this.#running = false;

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

      if (expected) {
        this.emit('end');
      } else if (code === 255) {
        if (this.#processHandle) {
          return;
        }

        if (!this.#sentData) {
          this.emit('error', {
            code: code,
            cmd: `${this.ffmpegPath} ${argsWithTokenRedacted}`,
          });
        }
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
        `${this.ffmpegName} received kill command but process already ended.`,
      );
      return;
    } else {
      this.#logger.debug(`${this.ffmpegName} received kill command`);
    }

    if (isDefined(this.#processHandle)) {
      this.#logger.debug(`${this.ffmpegName} sending SIGTERM`);
      if (isWindows()) {
        if (isUndefined(this.#processHandle.pid)) {
          this.#logger.warn(
            'Underlying process had no PID. This implies it was never properly started...',
          );
          return;
        }
        exec(`taskkill /pid ${this.#processHandle.pid} /t /f`, (err) => {
          if (!isNull(err)) {
            this.#processKilled = false;
            this.#logger.warn(err, 'Unable to kill process on Windows');
          }
        });
      } else {
        this.#processHandle.kill();
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
  }

  get ffmpegPath() {
    return this.ffmpegSettings.ffmpegExecutablePath;
  }

  get args() {
    return this.ffmpegArgs;
  }
}
