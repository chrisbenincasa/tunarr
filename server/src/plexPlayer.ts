/******************
 * This module has to follow the program-player contract.
 * Async call to get a stream.
 * * If connection to plex or the file entry fails completely before playing
 *   it rejects the promise and the error is an Error() class.
 * * Otherwise it returns a stream.
 **/
import EventEmitter from 'events';
import { isNil, isUndefined } from 'lodash-es';
import { Writable } from 'stream';
import constants from './constants.js';
import { PlexServerSettings } from './dao/entities/PlexServerSettings.js';
import { FFMPEG, FfmpegEvents } from './ffmpeg.js';
import createLogger from './logger.js';
import { Player } from './player.js';
import { PlexTranscoder } from './plexTranscoder.js';
import { PlayerContext } from './types.js';
import { TypedEventEmitter } from './types/eventEmitter.js';
import { isPlexBackedLineupItem } from './dao/derived_types/StreamLineup.js';

const USED_CLIENTS: Record<string, boolean> = {};
const logger = createLogger(import.meta);
export class PlexPlayer extends Player {
  private context: PlayerContext;
  private ffmpeg: FFMPEG | null;
  private plexTranscoder: PlexTranscoder | null;
  private killed: boolean;
  private clientId: string;

  constructor(context: PlayerContext) {
    super();
    this.context = context;
    this.ffmpeg = null;
    this.plexTranscoder = null;
    this.killed = false;
    const coreClientId = this.context.settings.clientId();
    let i = 0;
    while (USED_CLIENTS[coreClientId + '-' + i] === true) {
      i++;
    }
    this.clientId = coreClientId + '-' + i;
    USED_CLIENTS[this.clientId] = true;
  }

  cleanUp() {
    super.cleanUp();
    USED_CLIENTS[this.clientId] = false;
    this.killed = true;
    if (this.plexTranscoder != null) {
      this.plexTranscoder.stopUpdatingPlex().catch((e) => {
        logger.error('Error stopping Plex status updates', e);
      });
      this.plexTranscoder = null;
    }
    if (this.ffmpeg != null) {
      this.ffmpeg.kill();
      this.ffmpeg = null;
    }
  }

  async play(outStream: Writable) {
    const lineupItem = this.context.lineupItem;
    if (!isPlexBackedLineupItem(lineupItem)) {
      throw new Error(
        'Lineup item is not backed by Plex: ' + JSON.stringify(lineupItem),
      );
    }
    const ffmpegSettings = this.context.ffmpegSettings;
    const db = this.context.entityManager.repo(PlexServerSettings);
    const channel = this.context.channel;
    const server = await db.findOne({ name: lineupItem.serverKey });
    if (isNil(server)) {
      throw Error(
        `Unable to find server "${lineupItem.serverKey}" specified by program.`,
      );
    }
    if (server.uri.endsWith('/')) {
      server.uri = server.uri.slice(0, server.uri.length - 1);
    }

    const plexSettings = this.context.settings.plexSettings();
    const plexTranscoder = new PlexTranscoder(
      this.clientId,
      server,
      plexSettings,
      channel,
      lineupItem,
    );
    this.plexTranscoder = plexTranscoder;
    const watermark = this.context.watermark;
    let ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    ffmpeg.setAudioOnly(this.context.audioOnly);
    this.ffmpeg = ffmpeg;
    let streamDuration: number | undefined;
    if (
      !isUndefined(lineupItem.streamDuration) &&
      (lineupItem.start ?? 0) + lineupItem.streamDuration + constants.SLACK <
        lineupItem.duration
    ) {
      streamDuration = lineupItem.streamDuration / 1000;
    }
    const deinterlace = ffmpegSettings.enableTranscoding; //for now it will always deinterlace when transcoding is enabled but this is sub-optimal

    const stream = await plexTranscoder.getStream(deinterlace);
    if (this.killed) {
      return;
    }

    //let streamStart = (stream.directPlay) ? plexTranscoder.currTimeS : undefined;
    //let streamStart = (stream.directPlay) ? plexTranscoder.currTimeS : lineupItem.start;
    const streamStart = stream.directPlay
      ? plexTranscoder.currTimeS
      : undefined;
    const streamStats = stream.streamStats;
    if (streamStats) {
      streamStats.duration = lineupItem.streamDuration;
    }

    const emitter = new EventEmitter() as TypedEventEmitter<FfmpegEvents>;
    let ff = ffmpeg.spawnStream(
      stream.streamUrl,
      stream.streamStats,
      streamStart,
      streamDuration?.toString(),
      watermark,
      lineupItem.type,
    ); // Spawn the ffmpeg process

    if (isUndefined(ff)) {
      throw new Error('Unable to spawn ffmpeg');
    }

    ff.pipe(outStream, { end: false });
    plexTranscoder.startUpdatingPlex().catch((e) => {
      logger.error('Error starting Plex status updates', e);
    });

    ffmpeg.on('end', () => {
      logger.info('ffmpeg end');
      emitter.emit('end');
    });

    ffmpeg.on('close', () => {
      logger.info('ffmpeg close');
      emitter.emit('close');
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    ffmpeg.on('error', (err) => {
      console.log('Replacing failed stream with error stream');
      ff!.unpipe(outStream);
      // ffmpeg.removeAllListeners('data'); Type inference says this doesnt ever exist
      ffmpeg.removeAllListeners('end');
      ffmpeg.removeAllListeners('error');
      ffmpeg.removeAllListeners('close');
      ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
      ffmpeg.setAudioOnly(this.context.audioOnly);
      ffmpeg.on('close', () => {
        emitter.emit('close');
      });
      ffmpeg.on('end', () => {
        emitter.emit('end');
      });
      ffmpeg.on('error', (err) => {
        emitter.emit('error', err);
      });

      try {
        ff = ffmpeg.spawnError(
          'oops',
          'oops',
          Math.min(streamStats?.duration ?? 30000, 60000),
        );
        if (isUndefined(ff)) {
          throw new Error('Unable to spawn ffmpeg...what is going on here');
        }
        ff.pipe(outStream);
      } catch (err) {
        console.error('Err while trying to spawn error stream! YIKES', err);
      }

      emitter.emit('error', err);
    });
    return emitter;
  }
}
