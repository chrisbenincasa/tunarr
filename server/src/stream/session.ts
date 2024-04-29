import { FfmpegSettings } from '@tunarr/types';
import retry from 'async-retry';
import { isEmpty, isError, isNil, isUndefined, keys, once } from 'lodash-es';
import fs from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { inspect } from 'node:util';
import { v4 } from 'uuid';
import { Channel } from '../dao/entities/Channel.js';
import { FFMPEG } from '../ffmpeg/ffmpeg.js';
import { serverOptions } from '../globals.js';
import createLogger from '../logger.js';
import { isNodeError } from '../util/index.js';

const logger = createLogger(import.meta);

type SessionState = 'starting' | 'started' | 'error' | 'stopped' | 'init';

export type StreamConnectionDetails = {
  ip: string;
};

export class StreamSession {
  #channel: Channel;
  #ffmpegSettings: FfmpegSettings;
  #uniqueId: string;
  #ffmpeg: FFMPEG;
  #state: SessionState = 'init';
  #stream: Readable;
  #connections: Record<string, StreamConnectionDetails> = {};
  #heartbeats: Record<string, number> = {};
  #cleanupFunc: NodeJS.Timeout | null = null;
  #outPath: string;
  // Absolute path to the stream directory
  #streamPath: string;
  // The path to request streaming assets from the server
  #serverPath: string;

  private constructor(channel: Channel, ffmpegSettings: FfmpegSettings) {
    this.#uniqueId = v4();
    this.#channel = channel;
    this.#ffmpegSettings = ffmpegSettings;
    // TODO expost this as an option on FfmpegSettings
    this.#outPath = resolve(
      process.cwd(),
      'streams',
      `stream_${this.#channel.uuid}`,
    );
    this.#streamPath = join(this.#outPath, 'stream.m3u8');
    // Direct players back to the /hls URL which will return the playlist
    this.#serverPath = `/media-player/${this.#channel.uuid}/hls`;
  }

  static create(channel: Channel, ffmpegSettings: FfmpegSettings) {
    return new StreamSession(channel, ffmpegSettings);
  }

  async start() {
    if (this.#state !== 'starting') {
      this.#state = 'starting';
      await this.startStream();
    }
  }

  stop() {
    if (this.#state === 'started') {
      logger.debug('[Session %s] Stopping stream session', this.#channel.uuid);
      this.#ffmpeg.kill();
      setImmediate(() => {
        this.cleanupDirectory().catch((e) =>
          logger.error(
            'Error while attempting to cleanup stream directory: %O',
            e,
            { label: `Session ${this.#channel.uuid}` },
          ),
        );
      });
      this.#state = 'stopped';
    } else {
      logger.debug(
        '[Session %s] Wanted to shutdown session but state was %s',
        this.#channel.uuid,
        this.#state,
      );
    }
  }

  private async cleanupDirectory() {
    logger.debug(`Cleaning out stream path for session: %s`, this.#outPath);
    return fs
      .rm(this.#outPath, {
        recursive: true,
        force: true,
      })
      .catch((err) =>
        logger.error(
          'Failed to cleanup stream: %s %O',
          this.#channel.uuid,
          err,
        ),
      );
  }

  private async startStream() {
    const reqId = v4();
    console.time(reqId);
    this.#ffmpeg = new FFMPEG(this.#ffmpegSettings, this.#channel); // Set the transcoder options

    const stop = once(() => {
      this.#state = 'stopped';
      this.stop();
      this.#ffmpeg.kill();
    });

    this.#ffmpeg.on('error', (err) => {
      logger.error('[Session %s]: ffmpeg error %O', this.#channel.uuid, err);
      stop();
    });

    this.#ffmpeg.on('close', () => {
      logger.error('[Session %s]: ffmpeg close %O', this.#channel.uuid);
    });

    this.#ffmpeg.on('end', () => {
      logger.info('[Session %s]: Video queue exhausted.');
      stop();
    });

    logger.debug(`Creating stream directory: ${this.#outPath}`);

    try {
      await fs.stat(this.#outPath);
      await this.cleanupDirectory();
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        logger.debug("[Session %s]: Stream directory doesn't exist.");
      }
    } finally {
      await fs.mkdir(this.#outPath);
    }

    const stream = this.#ffmpeg.spawnConcat(
      `http://localhost:${serverOptions().port}/playlist?channel=${
        this.#channel.number
      }&audioOnly=false&hls=true`, // TODO FIX
      {
        enableHls: true,
        hlsOptions: {
          streamBasePath: `stream_${this.#channel.uuid}`,
          hlsTime: 3,
          hlsListSize: 8,
        },
        logOutput: false,
      },
    );

    if (stream) {
      // we may have solved this on the frontend...
      // await wait(5000); // How necessary is this really...
      this.#stream = stream;
      const onceListener = once(() => {
        console.timeEnd(reqId);
        stream.removeListener('data', onceListener);
      });

      // Wait for the stream to become ready
      try {
        await retry(
          async (bail) => {
            try {
              await fs.stat(this.#streamPath);
            } catch (e) {
              if (isNodeError(e) && e.code === 'ENOENT') {
                logger.debug(
                  '[Session %s] Still waiting for stream to start.',
                  this.#channel.uuid,
                );
                throw e; // Retry
              } else {
                this.#state === 'error';
                bail(isError(e) ? e : new Error('Unexplained error: ' + e));
              }
            }
          },
          {
            retries: 10,
            factor: 1.2,
          },
        );
      } catch (e) {
        logger.error('Error starting stream after retrying', e);
        this.#state = 'error';
        return;
      }

      stream.on('data', onceListener);

      this.#state = 'started';
    } else {
      this.#state = 'error';
    }
  }

  get id() {
    return this.#uniqueId;
  }

  get started() {
    return this.#state === 'started';
  }

  get stopped() {
    return this.#state === 'stopped';
  }

  get hasError() {
    return this.#state === 'error';
  }

  get rawStream() {
    return this.#stream;
  }

  addConnection(token: string, connection: StreamConnectionDetails) {
    this.#connections[token] = { ...connection };
    this.#heartbeats[token] = new Date().getTime();
    if (this.#cleanupFunc) {
      clearTimeout(this.#cleanupFunc);
    }
  }

  removeConnection(token: string) {
    delete this.#connections[token];
    delete this.#heartbeats[token];
  }

  connections() {
    return { ...this.#connections };
  }

  isKnownConnection(token: string) {
    return !isUndefined(this.#connections[token]);
  }

  numConnections() {
    return keys(this.#connections).length;
  }

  recordHeartbeat(token: string) {
    this.#heartbeats[token] = new Date().getTime();
  }

  lastHeartbeat(token: string) {
    return this.#heartbeats[token];
  }

  scheduleCleanup(delay: number) {
    if (this.#cleanupFunc) {
      logger.debug(
        '[Session %s] Cleanup already scheduled',
        this.#channel.uuid,
      );
      // We already scheduled shutdown
      return;
    }
    logger.debug('[Session %s] Scheduling shutdown', this.#channel.uuid);
    this.#cleanupFunc = setTimeout(() => {
      logger.debug('[Session %s] Shutting down session', this.#channel.uuid);
      if (isEmpty(this.#connections) && this.#ffmpeg) {
        this.stop();
      } else {
        logger.debug(
          `Got new connections: ${inspect(
            this.#connections,
          )}. Also ffmpeg = ${isNil(this.#ffmpeg)}`,
        );
      }
    }, delay);
  }

  get workingDirectory() {
    return this.#outPath;
  }

  get streamPath() {
    return this.#streamPath;
  }

  get serverPath() {
    return this.#serverPath;
  }
}
