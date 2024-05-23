/******************
 * This module has to follow the program-player contract.
 * Async call to get a stream.
 * * If connection to plex or the file entry fails completely before playing
 *   it rejects the promise and the error is an Error() class.
 * * Otherwise it returns a stream.
 **/
import constants from '@tunarr/shared/constants';
import EventEmitter from 'events';
import { isNil, isNull, isUndefined } from 'lodash-es';
import { Writable } from 'stream';
import { isContentBackedLineupIteam } from '../../dao/derived_types/StreamLineup.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { SettingsDB, getSettings } from '../../dao/settings.js';
import { FFMPEG, FfmpegEvents } from '../../ffmpeg/ffmpeg.js';
import { TypedEventEmitter } from '../../types/eventEmitter.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { Player, PlayerContext } from '../player.js';
import { PlexStreamDetails } from './PlexStreamDetails.js';
import { PlexTranscoder } from './plexTranscoder.js';

const USED_CLIENTS: Record<string, boolean> = {};
export class PlexPlayer extends Player {
  private logger = LoggerFactory.child({ caller: import.meta });
  private context: PlayerContext;
  private ffmpeg: FFMPEG | null;
  private plexTranscoder: PlexTranscoder | null;
  private killed: boolean;
  private clientId: string;

  constructor(
    context: PlayerContext,
    private setiingsDB: SettingsDB = getSettings(),
  ) {
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
        this.logger.error(e, 'Error stopping Plex status updates');
      });
      this.plexTranscoder = null;
    }
    if (this.ffmpeg != null) {
      this.ffmpeg.kill();
      this.ffmpeg = null;
    }
  }

  async play(
    outStream: Writable,
  ): Promise<TypedEventEmitter<FfmpegEvents> | undefined> {
    const lineupItem = this.context.lineupItem;
    if (!isContentBackedLineupIteam(lineupItem)) {
      throw new Error(
        'Lineup item is not backed by Plex: ' + JSON.stringify(lineupItem),
      );
    }

    const ffmpegSettings = this.context.ffmpegSettings;
    const db = this.context.entityManager.repo(PlexServerSettings);
    const channel = this.context.channel;
    const server = await db.findOne({ name: lineupItem.externalSourceId });
    if (isNil(server)) {
      throw Error(
        `Unable to find server "${lineupItem.externalSourceId}" specified by program.`,
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
    const plexStreamDetails = new PlexStreamDetails(server, this.setiingsDB);

    this.plexTranscoder = plexTranscoder;
    const watermark = this.context.watermark;
    this.ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    this.ffmpeg.setAudioOnly(this.context.audioOnly);

    let streamDuration: number | undefined;

    if (
      !isUndefined(lineupItem.streamDuration) &&
      (lineupItem.start ?? 0) + lineupItem.streamDuration + constants.SLACK <
        lineupItem.duration
    ) {
      streamDuration = lineupItem.streamDuration / 1000;
    }

    const stream = await plexStreamDetails.getStream(lineupItem);
    if (isNull(stream)) {
      this.logger.error('Unable to retrieve stream details from Plex');
      return;
    }

    // const stream = await plexTranscoder.getStream(/* deinterlace=*/ true);
    if (this.killed) {
      this.logger.warn('Plex stream was killed already, returning');
      return;
    }

    const streamStart = (lineupItem.start ?? 0) / 1000;
    const streamStats = stream.streamDetails;
    if (streamStats) {
      streamStats.duration = lineupItem.streamDuration;
    }
    console.log(stream);

    const emitter = new EventEmitter() as TypedEventEmitter<FfmpegEvents>;
    let ff = this.ffmpeg.spawnStream(
      stream.streamUrl,
      stream.streamDetails,
      streamStart,
      streamDuration?.toString(),
      watermark,
    ); // Spawn the ffmpeg process

    if (isUndefined(ff)) {
      throw new Error('Unable to spawn ffmpeg');
    }

    ff.pipe(outStream, { end: false });
    plexTranscoder.startUpdatingPlex().catch((e) => {
      this.logger.error(e, 'Error starting Plex status updates');
    });

    this.ffmpeg.on('end', () => {
      this.logger.trace('ffmpeg end');
      emitter.emit('end');
    });

    this.ffmpeg.on('close', () => {
      this.logger.trace('ffmpeg close');
      emitter.emit('close');
    });

    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    this.ffmpeg.on('error', (err) => {
      console.log('Replacing failed stream with error stream');
      ff!.unpipe(outStream);
      // ffmpeg.removeAllListeners('data'); Type inference says this doesnt ever exist
      this.ffmpeg?.removeAllListeners('end');
      this.ffmpeg?.removeAllListeners('error');
      this.ffmpeg?.removeAllListeners('close');
      this.ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
      this.ffmpeg.setAudioOnly(this.context.audioOnly);
      this.ffmpeg.on('close', () => {
        emitter.emit('close');
      });
      this.ffmpeg.on('end', () => {
        emitter.emit('end');
      });
      this.ffmpeg.on('error', (err) => {
        emitter.emit('error', err);
      });

      try {
        ff = this.ffmpeg.spawnError(
          'oops',
          'oops',
          Math.min(streamStats?.duration ?? 30000, 60000),
        );
        if (isUndefined(ff)) {
          throw new Error('Unable to spawn ffmpeg...what is going on here');
        }
        ff.pipe(outStream);
      } catch (err) {
        this.logger.error(err, 'Err while trying to spawn error stream! YIKES');
      }

      emitter.emit('error', err);
    });
    return emitter;
  }
}
