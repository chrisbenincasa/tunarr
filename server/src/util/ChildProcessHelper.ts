import { fileExists } from '@/util/fsUtil.js';
import { isNonEmptyString } from '@/util/index.js';
import { sanitizeForExec } from '@/util/strings.js';
import { inject, injectable } from 'inversify';
import { isEmpty } from 'lodash-es';
import type {
  ChildProcessByStdio,
  ExecOptions,
  SpawnOptions,
} from 'node:child_process';
import { execFile, spawn } from 'node:child_process';
import events from 'node:events';
import { Readable } from 'node:stream';
import PQueue from 'p-queue';
import { TypedEventEmitter } from '../types/eventEmitter.ts';
import { KEYS } from '../types/inject.ts';
import { LastNBytesStream } from './LastNBytesStream.ts';
import { Logger, LoggerFactory } from './logging/LoggerFactory.ts';

type SpawnOpts = {
  name: string;
  restartOnFailure: boolean;
  maxAttempts: number;
  additionalOpts?: SpawnOptions;
};

type ChildProcessEvents = {
  restart: () => void;
};

abstract class ITypedEventEmitter extends (events.EventEmitter as new () => TypedEventEmitter<ChildProcessEvents>) {}

const _internalStart = Symbol('ChildProcessWrapper#start');

export class ChildProcessWrapper extends ITypedEventEmitter {
  private underlying?: ChildProcessByStdio<null, Readable, Readable>;
  private attempts = 0;
  private wasAborted = false;

  constructor(
    private logger: Logger,
    private path: string,
    private args: readonly string[],
    private opts: SpawnOpts,
    private controller: AbortController,
    private env?: NodeJS.ProcessEnv,
  ) {
    super();
  }

  get process() {
    return this.underlying;
  }

  get abortController() {
    return this.controller;
  }

  kill(signal: NodeJS.Signals = 'SIGTERM') {
    if (!this.wasAborted) {
      this.wasAborted = true;
      this.underlying?.kill(signal);
    }
  }

  [_internalStart]() {
    this.attempts++;
    if (this.attempts > this.opts.maxAttempts) {
      this.logger.fatal(
        'Unable to start process %s after %d attempts. Giving up',
        this.opts.name,
        this.opts.maxAttempts,
      );
      throw new Error('Cannot start sub process');
    }

    this.logger.debug('Starting process: %s %O', this.path, this.args);
    const proc = spawn(this.path, this.args, {
      ...(this.opts.additionalOpts ?? {}),
      stdio: ['ignore', 'pipe', 'pipe'],
      signal: this.controller.signal,
      env: this.env,
      detached: false,
    });

    const bufferedOut = new LastNBytesStream({ bufSizeBytes: 10 * 1024 });
    proc.stderr.pipe(bufferedOut);

    proc.on('error', (err) => {
      this.logger.error(err, 'Error!');

      if (!this.opts.restartOnFailure) {
        return; // Do not attempt to restart if we manually aborted.
      }

      this[_internalStart]();
    });

    proc.on('exit', (code, signal) => {
      this.logger.warn(
        'Process (name = %s, pid = %d) died with code = %d and signal %s',
        this.opts.name,
        proc.pid ?? -1,
        code ?? -1,
        signal ?? 'UNKNOWN',
      );

      if (!this.wasAborted && code !== 0) {
        const bufferedBytes = bufferedOut.getLastN().toString('utf-8');
        this.logger.error(bufferedBytes);
        console.error(bufferedBytes);
      }

      if (!this.wasAborted && this.opts.restartOnFailure) {
        this.logger.debug('Attempting to restart process');
        this[_internalStart]();
      }
    });

    this.underlying = proc;
    return proc;
  }
}

export type GetStdoutOptions = {
  swallowError?: boolean;
  env?: NodeJS.ProcessEnv;
  isPath?: boolean;
  timeout?: number;
};

@injectable()
export class ChildProcessHelper {
  private execQueue = new PQueue({ concurrency: 3 });

  constructor(
    @inject(KEYS.Logger)
    private logger: Logger = LoggerFactory.child({
      className: ChildProcessHelper.name,
    }),
  ) {}

  getStdout(
    executable: string,
    args: string[],
    opts: GetStdoutOptions = { swallowError: false, isPath: true },
  ): Promise<string> {
    const { timeout, env, swallowError, isPath } = opts;
    return this.execQueue.add(
      async () => {
        const sanitizedPath = sanitizeForExec(executable);
        if (isPath && !(await fileExists(sanitizedPath))) {
          throw new Error(`Path at ${sanitizedPath} does not exist`);
        }

        const opts: ExecOptions = {
          windowsHide: true,
          timeout,
        };

        if (!isEmpty(env)) {
          opts.env = env;
        }

        this.logger.debug(
          `Executing child process: "${sanitizedPath}" ${args.join(' ')}`,
        );

        return await new Promise((resolve, reject) => {
          execFile(sanitizedPath, args, opts, function (error, stdout, stderr) {
            if (error !== null && !swallowError) {
              // eslint-disable-next-line @typescript-eslint/prefer-promise-reject-errors
              reject(error);
            }
            resolve(isNonEmptyString(stdout) ? stdout : stderr);
          });
        });
      },
      { throwOnTimeout: true },
    );
  }

  async spawn(
    executable: string,
    args: readonly string[],
    opts?: Partial<SpawnOpts>,
    env?: NodeJS.ProcessEnv,
    isPath: boolean = true,
  ) {
    const resolvedOpts = createDefaultSpawnOpts(opts);
    const sanitizedPath = sanitizeForExec(executable);
    if (isPath && !(await fileExists(sanitizedPath))) {
      throw new Error(`Path at ${sanitizedPath} does not exist`);
    }
    this.logger.debug(
      `Spawning child process: "${sanitizedPath}" ${args.join(' ')}`,
    );

    const controller = new AbortController();

    const wrapper = new ChildProcessWrapper(
      this.logger,
      sanitizedPath,
      args,
      resolvedOpts,
      controller,
      env,
    );
    wrapper[_internalStart]();

    return wrapper;
  }
}

function createDefaultSpawnOpts(opts?: Partial<SpawnOpts>): SpawnOpts {
  return {
    restartOnFailure: opts?.restartOnFailure ?? true,
    maxAttempts: opts?.maxAttempts ?? 1,
    name: opts?.name ?? 'unknown',
  } satisfies SpawnOpts;
}
