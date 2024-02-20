import { FfmpegSettings } from '@tunarr/types';
import retry from 'async-retry';
import { isEmpty, isError, isUndefined, keys, once } from 'lodash-es';
import fs from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';
import { v4 } from 'uuid';
import { Channel } from '../dao/entities/Channel.js';
import { FFMPEG } from '../ffmpeg.js';
import { serverOptions } from '../globals.js';
import createLogger from '../logger.js';
import { isNodeError, wait } from '../util.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

  private constructor(channel: Channel, ffmpegSettings: FfmpegSettings) {
    this.#uniqueId = v4();
    this.#channel = channel;
    this.#ffmpegSettings = ffmpegSettings;
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
        fs.rm(
          resolve(__dirname, '..', 'streams', `stream_${this.#channel.uuid}`),
          { recursive: true, force: true },
        ).catch((err) =>
          logger.error(
            'Failed to cleanup stream: %s %O',
            this.#channel.uuid,
            err,
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
      logger.info(
        'Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.',
      );
      stop();
    });

    // TODO this is hacky
    const outPath = resolve(
      __dirname,
      '..',
      'streams',
      `stream_${this.#channel.uuid}`,
    );
    try {
      await fs.stat(outPath);
    } catch (e) {
      if (isNodeError(e) && e.code === 'ENOENT') {
        await fs.mkdir(outPath);
      }
    }

    const stream = this.#ffmpeg.spawnConcat(
      `http://localhost:${serverOptions().port}/playlist?channel=${
        this.#channel.number
      }&audioOnly=false`, // TODO FIX
      {
        enableHls: true,
        streamBasePath: `stream_${this.#channel.uuid}`,
        hlsTime: 2,
        hlsListSize: 5,
      },
    );

    if (stream) {
      await wait(5000); // How necessary is this really...
      this.#stream = stream;
      const onceListener = once(() => {
        console.timeEnd(reqId);
        stream.removeListener('data', onceListener);
      });

      // TODO this is hacky
      const streamPath = join(outPath, 'stream.m3u8');

      // Wait for the stream to become ready
      await retry(
        async (bail) => {
          try {
            await fs.stat(streamPath);
          } catch (e) {
            if (isNodeError(e) && e.code === 'ENOENT') {
              console.warn('not found yet');
              throw e; // Retry
            } else {
              this.#state === 'error';
              bail(isError(e) ? e : new Error('Unexplained error: ' + e));
            }
          }
        },
        {
          retries: 10,
        },
      );

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
      // We already scheduled shutdown
      return;
    }
    logger.debug('[Session %s] Scheduling shutdown', this.#channel.uuid);
    this.#cleanupFunc = setTimeout(() => {
      logger.debug('[Session %s] Shutting down session', this.#channel.uuid);
      if (isEmpty(this.#connections) && this.#ffmpeg) {
        this.stop();
      }
    }, delay);
  }

  get streamPath() {
    return `/streams/stream_${this.#channel.uuid}/stream.m3u8`;
  }
}
