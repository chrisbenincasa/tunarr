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

import { OfflinePlayer } from './offline-player.js';
import { PlexPlayer } from './plex-player.js';
import EventEmitter from 'events';
import * as helperFuncs from './helperFuncs.js';
import { PlayerContext } from './types.js';

export class ProgramPlayer {
  private context: any;
  private delegate: any;

  constructor(context: PlayerContext) {
    this.context = context;
    let program = context.lineupItem;
    if (context.m3u8) {
      context.ffmpegSettings.normalizeAudio = false;
      // people might want the codec normalization to stay because of player support
      context.ffmpegSettings.normalizeResolution = false;
    }
    if (typeof program.err !== 'undefined') {
      console.log('About to play error stream');
      this.delegate = new OfflinePlayer(true, context);
    } else if (program.type === 'loading') {
      console.log('About to play loading stream');
      /* loading */
      context.isLoading = true;
      this.delegate = new OfflinePlayer(false, context);
    } else if (program.type === 'offline') {
      console.log('About to play offline stream');
      /* offline */
      this.delegate = new OfflinePlayer(false, context);
    } else {
      console.log('About to play plex stream');
      /* plex */
      this.delegate = new PlexPlayer(context);
    }
    this.context.watermark = helperFuncs.getWatermark(
      context.ffmpegSettings,
      context.channel,
      context.lineupItem.type,
    );
  }

  cleanUp() {
    this.delegate.cleanUp();
  }

  async playDelegate(outStream) {
    return await new Promise(async (accept, reject) => {
      try {
        let stream = await this.delegate.play(outStream);
        accept(stream);
        let emitter = new EventEmitter();
        function end() {
          reject(Error('Stream ended with no data'));
          stream.removeAllListeners('data');
          stream.removeAllListeners('end');
          stream.removeAllListeners('close');
          stream.removeAllListeners('error');
          emitter.emit('end');
        }
        stream.on('error', (err) => {
          reject(
            Error('Stream ended in error with no data. ' + JSON.stringify(err)),
          );
          end();
        });
        stream.on('end', end);
        stream.on('close', end);
      } catch (err) {
        reject(err);
      }
    });
  }
  async play(outStream) {
    try {
      return await this.playDelegate(outStream);
    } catch (err) {
      if (!(err instanceof Error)) {
        err = Error(
          'Program player had an error before receiving any data. ' +
            JSON.stringify(err),
        );
      }
      if (this.context.lineupItem.err instanceof Error) {
        console.log(err.stack);
        throw Error('Additional error when attempting to play error stream.');
      }
      console.log(
        'Error when attempting to play video. Fallback to error stream: ' +
          err.stack,
      );
      //Retry once with an error stream:
      this.context.lineupItem = {
        err: err,
        start: this.context.lineupItem.start,
        streamDuration: this.context.lineupItem.streamDuration,
      };
      this.delegate.cleanUp();
      this.delegate = new OfflinePlayer(true, this.context);
      return await this.play(outStream);
    }
  }
}
