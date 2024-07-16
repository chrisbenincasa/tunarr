/******************
 * This module is to take a "program" and return a stream that plays the
 * program. OR the promise fails which would mean that there was an error
 * playing the program.
 *
 * The main purpose is to have an abstract interface for playing program
 * objects without having to worry the source of the program object.
 * A long-term goal is to be able to have sources other than plex to play
 * videos. This is the first step towards that goal.
 *
 * Returns an event emitter that will have the 'data' or 'end' events.
 * The contract is that the emitter will stream at least some media stream
 * before ending. Any errors that occur after sending the first data will
 * be dealt with internally and be presented as an 'end' event.
 *
 * If there is a timeout when receiving the initial data, or if the program
 * can't load at all for some reason, an Error will be thrown. Make sure to
 * deal with the thrown error.
 **/

import { FfmpegSettings, Watermark } from '@tunarr/types';
import { isError, isString, isUndefined } from 'lodash-es';
import { Writable } from 'stream';
import { isContentBackedLineupIteam } from '../dao/derived_types/StreamLineup.js';
import { FfmpegEvents } from '../ffmpeg/ffmpeg.js';
import { TypedEventEmitter } from '../types/eventEmitter.js';
import { Maybe } from '../types/util.js';
import { isNonEmptyString } from '../util/index.js';
import { OfflinePlayer } from './OfflinePlayer.js';
import { Player, PlayerContext } from './Player.js';
import { PlexPlayer } from './plex/PlexPlayer.js';
import { StreamContextChannel } from './types.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { serverOptions } from '../globals.js';

export class ProgramPlayer extends Player {
  private logger = LoggerFactory.child({ caller: import.meta });
  private context: PlayerContext;
  private delegate: Player;

  constructor(context: PlayerContext) {
    super();
    this.context = context;
    const program = context.lineupItem;
    if (context.m3u8) {
      context.ffmpegSettings.normalizeAudio = false;
      // people might want the codec normalization to stay because of player support
      context.ffmpegSettings.normalizeResolution = false;
    }

    if (program.type === 'error') {
      this.logger.debug('About to play error stream');
      this.delegate = new OfflinePlayer(true, context);
    } else if (program.type === 'loading') {
      this.logger.debug('About to play loading stream');
      /* loading */
      context.isLoading = true;
      this.delegate = new OfflinePlayer(false, context);
    } else if (program.type === 'offline') {
      this.logger.debug('About to play offline stream');
      /* offline */
      this.delegate = new OfflinePlayer(false, context);
    } else if (isContentBackedLineupIteam(program) && program) {
      this.logger.debug('About to play plex stream');
      /* plex */
      this.delegate = new PlexPlayer(context);
    }
    this.context.watermark = this.getWatermark(
      context.ffmpegSettings,
      context.channel,
      context.lineupItem.type,
    );
  }

  cleanUp() {
    this.delegate.cleanUp();
  }

  private playDelegate(
    outStream: Writable,
  ): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>> {
    return new Promise((resolve, reject) => {
      try {
        // This code makes no sense.
        this.delegate
          .play(outStream)
          .then((stream) => {
            resolve(stream);
            // const emitter = new EventEmitter();
            // function end() {
            //   reject(Error('Stream ended with no data'));
            //   // stream.removeAllListeners('data');
            //   stream?.removeAllListeners('end');
            //   stream?.removeAllListeners('close');
            //   stream?.removeAllListeners('error');
            //   emitter.emit('end');
            // }
            // stream?.on('error', (err) => {
            //   reject(
            //     Error(
            //       'Stream ended in error with no data. ' + JSON.stringify(err),
            //     ),
            //   );
            //   end();
            // });
            // stream?.on('end', end);
            // stream?.on('close', end);
          })
          .catch(reject);
      } catch (err) {
        reject(err);
      }
    });
  }

  async play(
    outStream: Writable,
  ): Promise<Maybe<TypedEventEmitter<FfmpegEvents>>> {
    try {
      return await this.playDelegate(outStream);
    } catch (err) {
      let actualError: Error;
      if (!isError(err)) {
        actualError = new Error(
          'Program player had an error before receiving any data. ' +
            JSON.stringify(err),
        );
      } else {
        actualError = err;
      }
      if (this.context.lineupItem.type === 'error') {
        const msg = isString(this.context.lineupItem.error)
          ? this.context.lineupItem.error
          : '';
        throw new Error(
          'Additional error when attempting to play error stream. ' + msg,
        );
      }
      this.logger.error(
        'Error when attempting to play video. Fallback to error stream: ' +
          actualError.stack,
      );
      //Retry once with an error stream:
      this.context.lineupItem = {
        type: 'error',
        error: actualError.message,
        start: this.context.lineupItem.start,
        streamDuration: this.context.lineupItem.streamDuration,
        duration: this.context.lineupItem.duration,
      };
      this.delegate.cleanUp();
      this.delegate = new OfflinePlayer(true, this.context);
      return await this.play(outStream);
    }
  }

  private getWatermark(
    ffmpegSettings: FfmpegSettings,
    channel: StreamContextChannel,
    type: string,
  ): Maybe<Watermark> {
    if (ffmpegSettings.disableChannelOverlay) {
      return;
    }

    let disableFillerOverlay = channel.disableFillerOverlay;
    if (isUndefined(disableFillerOverlay)) {
      disableFillerOverlay = true;
    }

    if (type === 'commercial' && disableFillerOverlay) {
      return;
    }

    if (!isUndefined(channel.watermark) && channel.watermark.enabled) {
      const watermark = { ...channel.watermark };
      let icon: string;
      if (isNonEmptyString(watermark.url)) {
        icon = watermark.url;
      } else if (isNonEmptyString(channel.icon?.path)) {
        icon = channel.icon.path;
      } else {
        icon = `http://localhost:${serverOptions().port}/images/tunarr.png`;
      }

      return {
        ...watermark,
        enabled: true,
        url: icon,
      };
    }

    return;
  }
}
