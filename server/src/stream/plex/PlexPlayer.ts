import constants from '@tunarr/shared/constants';
import EventEmitter from 'events';
import { isNil, isNull, isUndefined } from 'lodash-es';
import { Writable } from 'stream';
import { isContentBackedLineupIteam } from '../../dao/derived_types/StreamLineup.js';
import { PlexServerSettings } from '../../dao/entities/PlexServerSettings.js';
import { FFMPEG, FfmpegEvents } from '../../ffmpeg/ffmpeg.js';
import { GlobalScheduler } from '../../services/scheduler.js';
import { UpdatePlexPlayStatusScheduledTask } from '../../tasks/UpdatePlexPlayStatusTask.js';
import { TypedEventEmitter } from '../../types/eventEmitter.js';
import { Maybe, Nullable } from '../../types/util.js';
import { ifDefined } from '../../util/index.js';
import { LoggerFactory } from '../../util/logging/LoggerFactory.js';
import { Player, PlayerContext } from '../Player.js';
import { PlexStreamDetails } from './PlexStreamDetails.js';

const USED_CLIENTS: Record<string, boolean> = {};

export class PlexPlayer extends Player {
  private logger = LoggerFactory.child({ caller: import.meta });
  private ffmpeg: Nullable<FFMPEG> = null;
  private killed: boolean = false;
  private clientId: string;
  private updatePlexStatusTask: Maybe<UpdatePlexPlayStatusScheduledTask>;

  constructor(private context: PlayerContext) {
    super();
    // TODO: Is this even useful??
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
    ifDefined(this.updatePlexStatusTask, (task) => {
      task.stop();
    });

    if (this.ffmpeg !== null) {
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
    const plexStreamDetails = new PlexStreamDetails(
      server,
      this.context.settings,
    );

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

    if (this.killed) {
      this.logger.warn('Plex stream was killed already, returning');
      return;
    }

    const streamStart = (lineupItem.start ?? 0) / 1000;
    const streamStats = stream.streamDetails;
    if (streamStats) {
      streamStats.duration = lineupItem.streamDuration;
    }

    const emitter = new EventEmitter() as TypedEventEmitter<FfmpegEvents>;
    let ffmpegOutStream = this.ffmpeg.spawnStream(
      stream.streamUrl,
      stream.streamDetails,
      streamStart,
      streamDuration?.toString(),
      watermark,
    ); // Spawn the ffmpeg process

    if (isUndefined(ffmpegOutStream)) {
      throw new Error('Unable to spawn ffmpeg');
    }

    ffmpegOutStream.pipe(outStream, { end: false });

    if (plexSettings.updatePlayStatus) {
      this.updatePlexStatusTask = new UpdatePlexPlayStatusScheduledTask(
        server,
        {
          channelNumber: channel.number,
          duration: lineupItem.duration,
          ratingKey: lineupItem.externalKey,
          startTime: lineupItem.start ?? 0,
        },
      );

      GlobalScheduler.scheduleTask(
        this.updatePlexStatusTask.id,
        this.updatePlexStatusTask,
      );
    }

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
      this.logger.debug('Replacing failed stream with error stream');
      ffmpegOutStream!.unpipe(outStream);
      this.ffmpeg?.removeAllListeners();
      // TODO: Extremely weird logic here leftover, should sort this all out.
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
        ffmpegOutStream = this.ffmpeg.spawnError(
          'oops',
          'oops',
          Math.min(streamStats?.duration ?? 30000, 60000),
        );
        if (isUndefined(ffmpegOutStream)) {
          throw new Error('Unable to spawn ffmpeg...what is going on here');
        }
        ffmpegOutStream.pipe(outStream);
      } catch (err) {
        this.logger.error(err, 'Err while trying to spawn error stream! YIKES');
      }

      emitter.emit('error', err);
    });
    return emitter;
  }
}
