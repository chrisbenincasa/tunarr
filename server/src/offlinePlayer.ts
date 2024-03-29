/******************
 * Offline player is for special screens, like the error
 * screen or the Flex Fallback screen.
 *
 * This module has to follow the program-player contract.
 * Asynchronous call to return a stream. Then the stream
 * can be used to play the program.
 **/
import EventEmitter from 'events';
import { isError } from 'lodash-es';
import { Readable, Writable } from 'stream';
import { FFMPEG, FfmpegEvents } from './ffmpeg.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { Player } from './player.js';
import { Maybe, PlayerContext } from './types.js';
import { TypedEventEmitter } from './types/eventEmitter.js';

const logger = createLogger(import.meta);

export class OfflinePlayer extends Player {
  private context: PlayerContext;
  private error: boolean;
  private ffmpeg: FFMPEG;

  constructor(error: boolean, context: PlayerContext) {
    super();
    this.context = context;
    this.error = error;
    if (context.isLoading === true) {
      context.channel = {
        ...context.channel,
        offlinePicture: `http://localhost:${
          serverOptions().port
        }/images/loading-screen.png`,
        offlineSoundtrack: undefined,
      };
    }
    this.ffmpeg = new FFMPEG(context.ffmpegSettings, context.channel);
    console.log(this.context);
    this.ffmpeg.setAudioOnly(this.context.audioOnly);
  }

  cleanUp() {
    super.cleanUp();
    this.ffmpeg.kill();
  }

  play(outStream: Writable): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>> {
    try {
      const emitter = new EventEmitter() as TypedEventEmitter<FfmpegEvents>;
      let ffmpeg = this.ffmpeg;
      const lineupItem = this.context.lineupItem;
      const duration = lineupItem.streamDuration ?? 0 - (lineupItem.start ?? 0);

      let ff: Maybe<Readable>;
      if (this.error) {
        ff = ffmpeg.spawnError('Error', undefined, duration);
      } else {
        ff = ffmpeg.spawnOffline(duration);
      }

      ff?.pipe(outStream, { end: false });

      ffmpeg.on('end', () => {
        logger.debug('offline player end');
        emitter.emit('end');
      });

      ffmpeg.on('close', () => {
        logger.debug('offline player close');
        emitter.emit('close');
      });

      ffmpeg.on('error', (err) => {
        logger.error('offline player error: %O', err);

        //wish this code wasn't repeated.
        if (!this.error) {
          logger.debug('Replacing failed stream with error stream');
          ff?.unpipe(outStream);
          // ffmpeg.removeAllListeners('data'); Type inference says this is never actually used...
          ffmpeg.removeAllListeners('end');
          ffmpeg.removeAllListeners('error');
          ffmpeg.removeAllListeners('close');
          ffmpeg = new FFMPEG(
            this.context.ffmpegSettings,
            this.context.channel,
          ); // Set the transcoder options
          ffmpeg.setAudioOnly(this.context.audioOnly);
          ffmpeg.on('close', () => {
            emitter.emit('close');
          });
          ffmpeg.on('end', () => {
            emitter.emit('end');
          });
          ffmpeg.on('error', (err) => {
            logger.error('Emitting error ... %O', err);
            emitter.emit('error', err);
          });

          ff = ffmpeg.spawnError('oops', 'oops', Math.min(duration, 60000));

          ff?.pipe(outStream);
        } else {
          emitter.emit('error', err);
        }
      });
      return Promise.resolve(emitter);
    } catch (err) {
      if (isError(err)) {
        throw err;
      } else {
        throw Error(
          'Error when attempting to play offline screen: ' +
            JSON.stringify(err),
        );
      }
    }
  }
}
