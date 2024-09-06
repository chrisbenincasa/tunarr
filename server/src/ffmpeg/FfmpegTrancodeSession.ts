import { isUndefined } from 'lodash-es';
import events from 'node:events';
import { PassThrough } from 'node:stream';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { FfmpegProcess } from './FfmpegProcess.js';
import { FfmpegEvents } from './ffmpeg.js';

enum State {
  Idle = 'idle',
  Started = 'started',
  Ended = 'ended',
  Error = 'error',
}

/**
 * Represents a single ffmpeg transcode stream. Allows for interaction
 * with the underlying ffmpeg process, emits relevant events, and contains
 * metadata about the stream.
 */
export class FfmpegTranscodeSession extends (events.EventEmitter as new () => TypedEventEmitter<FfmpegEvents>) {
  private logger = LoggerFactory.child({
    className: FfmpegTranscodeSession.name,
    caller: import.meta,
  });
  private state = State.Idle;

  constructor(
    public process: FfmpegProcess,
    public streamEndTime: number,
  ) {
    super();
    // Connect the session to the process.
    // The transcode session simply forwards all of the events
    // of the underlying process to consumers
    this.process.on('close', (...args) => {
      this.emit('close', ...args);
    });

    this.process.on('end', (...args) => {
      this.emit('end', ...args);
    });

    this.process.on('error', (...args) => {
      this.emit('error', ...args);
    });
  }

  start(sink: PassThrough) {
    if (this.state !== State.Idle) {
      throw new Error(
        `Session was already started, or has ended (current state = ${this.state})`,
      );
    }

    const rawStream = this.process.start();
    if (isUndefined(rawStream)) {
      this.state = State.Error;
      this.kill();
      throw new Error('Error starting the underlying ffmpeg process.');
    }

    this.process.on('end', () => {
      this.state = State.Ended;
      this.kill();
      sink.push(null);
    });

    this.process.on('error', (err) => {
      this.state = State.Error;
      this.logger.error(err, 'Error playing video');
      rawStream.unpipe(sink);
    });

    return rawStream.pipe(sink, { end: false });
  }

  kill() {
    this.state = State.Ended;
    return this.process.kill();
  }
}
