import { Loaded, RequestContext } from '@mikro-orm/core';
import constants from '@tunarr/shared/constants';
import { isNil, isUndefined, once } from 'lodash-es';
import { PassThrough, Readable } from 'node:stream';
import { EntityManager } from '../dao/dataSource';
import { createOfflineStreamLineupIteam } from '../dao/derived_types/StreamLineup';
import {
  ProgramAndTimeElapsed,
  createLineup,
  generateChannelContext,
  getCurrentProgramAndTimeElapsed,
} from '../helperFuncs';
import createLogger from '../logger';
import { ProgramPlayer } from '../programPlayer';
import { getServerContext } from '../serverContext';
import { wereThereTooManyAttempts } from '../throttler';
import { ContextChannel, PlayerContext } from '../types';
import { StreamQueryString } from '../types/schemas';
import { deepCopy } from '../util';
import { fileExists } from '../util/fsUtil';
import { Channel } from '../dao/entities/Channel';

const logger = createLogger(import.meta);

type VideoStreamSuccessResult = {
  type: 'success';
  stream: Readable;
  stop(): void;
};

type VideoStreamErrorResult = {
  type: 'error';
  httpStatus: number;
  message: string;
  error?: unknown;
};

type VideoStreamResult = VideoStreamSuccessResult | VideoStreamErrorResult;

/**
 * Starts a video stream for the given channel, playing the show airing at the
 * given timestamp
 */
export class VideoStream {
  async startStream(
    req: StreamQueryString,
    t0: number,
    allowSkip: boolean,
  ): Promise<VideoStreamResult> {
    const start = performance.now();
    const serverCtx = getServerContext();
    const outStream = new PassThrough();

    if (isUndefined(req.channel)) {
      return {
        type: 'error',
        httpStatus: 400,
        message: 'No Channel Specified',
      };
    }

    const audioOnly = req.audioOnly;
    const session = req.session;
    const m3u8 = req.m3u8 ?? false;
    const channel = await serverCtx.channelDB.getChannel(req.channel);

    if (isNil(channel)) {
      return {
        type: 'error',
        httpStatus: 404,
        message: `Channel ${req.channel} doesn't exist`,
      };
    }

    const lineup = await serverCtx.channelDB.loadLineup(channel.uuid);

    if (isNil(channel)) {
      return {
        type: 'error',
        httpStatus: 404,
        message: `Channel ${req.channel} doesn't exist`,
      };
    }

    let isLoading = false;
    if (req.first === 0) {
      isLoading = true;
    }

    let isFirst = false;
    if (req.first === 1) {
      isFirst = true;
    }

    const ffmpegSettings = serverCtx.settings.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!(await fileExists(ffmpegSettings.ffmpegExecutablePath))) {
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );

      return {
        type: 'error',
        httpStatus: 500,
        message: `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      };
    }

    // Get video lineup (array of video urls with calculated start times and durations.)
    let lineupItem = serverCtx.channelCache.getCurrentLineupItem(
      channel.uuid,
      t0,
    );
    let currentProgram: ProgramAndTimeElapsed | undefined;
    let channelContext: Loaded<Channel> = channel;
    const redirectChannels: string[] = [];
    const upperBounds: number[] = [];

    // Insert 40ms of loading time in front of the stream (let's look into this one later)
    if (isLoading) {
      lineupItem = {
        type: 'loading',
        streamDuration: 40,
        duration: 40,
        start: 0,
      };
    } else if (isUndefined(lineupItem)) {
      const lineup = await serverCtx.channelDB.loadLineup(channel.uuid);
      currentProgram = await getCurrentProgramAndTimeElapsed(
        t0,
        channel,
        lineup,
      );

      for (;;) {
        redirectChannels.push(channelContext.uuid);
        upperBounds.push(
          currentProgram.program.duration - currentProgram.timeElapsed,
        );

        if (
          // currentProgram.program.type !== 'offline'
          currentProgram.program.type !== 'redirect'
        ) {
          break;
        }

        serverCtx.channelCache.recordPlayback(channelContext.uuid, t0, {
          type: 'offline',
          title: 'Error',
          err: new Error('Recursive channel redirect found'),
          duration: 60000,
          start: 0,
        });

        const newChannelNumber = currentProgram.program.channel;
        const newChannel =
          await serverCtx.channelCache.getChannelConfigWithPrograms(
            newChannelNumber,
          );

        if (isNil(newChannel)) {
          const err = new Error(
            "Invalid redirect to a channel that doesn't exist",
          );
          logger.error("Invalid redirect to channel that doesn't exist.", err);
          currentProgram = {
            program: createOfflineStreamLineupIteam(60000),
            timeElapsed: 0,
            programIndex: -1,
          };
          continue;
        }

        channelContext = newChannel;
        lineupItem = serverCtx.channelCache.getCurrentLineupItem(
          newChannel.uuid,
          t0,
        );

        if (!isUndefined(lineupItem)) {
          lineupItem = deepCopy(lineupItem);
          break;
        } else {
          currentProgram = await getCurrentProgramAndTimeElapsed(
            t0,
            newChannel,
            lineup,
          );
        }
      }
    }

    if (isUndefined(lineupItem)) {
      if (isNil(currentProgram)) {
        // return res.status(500).send('server error');
        return {
          type: 'error',
          httpStatus: 500,
          message: 'Could not find currentProgram for channel',
        };
      }

      if (
        currentProgram.program.type === 'offline' &&
        lineup.items.length === 1 &&
        currentProgram.programIndex !== -1
      ) {
        //there's only one program and it's offline. So really, the channel is
        //permanently offline, it doesn't matter what duration was set
        //and it's best to give it a long duration to ensure there's always
        //filler to play (if any)
        const t = 365 * 24 * 60 * 60 * 1000;
        currentProgram.program = createOfflineStreamLineupIteam(t);
      } else if (
        allowSkip &&
        currentProgram.program.type === 'offline' &&
        currentProgram.program.duration - currentProgram.timeElapsed <=
          constants.SLACK + 1
      ) {
        //it's pointless to show the offline screen for such a short time, might as well
        //skip to the next program
        const dt = currentProgram.program.duration - currentProgram.timeElapsed;
        for (let i = 0; i < redirectChannels.length; i++) {
          serverCtx.channelCache.clearPlayback(redirectChannels[i]);
        }
        logger.info(
          'Too little time before the filler ends, skip to next slot',
        );
        return await this.startStream(req, t0 + dt + 1, false);
      }
      if (isNil(currentProgram) || isNil(currentProgram.program)) {
        throw "No video to play, this means there's a serious unexpected bug or the channel db is corrupted.";
      }

      lineupItem = await createLineup(
        serverCtx.channelCache,
        currentProgram,
        channelContext,
        isFirst,
      ).then((items) => items.shift());
    }

    if (!isLoading && !isUndefined(lineupItem)) {
      let upperBound = Number.MAX_SAFE_INTEGER;
      let beginningOffset = 0;
      if (!isUndefined(lineupItem?.beginningOffset)) {
        beginningOffset = lineupItem.beginningOffset;
      }
      //adjust upper bounds and record playbacks
      for (let i = redirectChannels.length - 1; i >= 0; i--) {
        lineupItem = deepCopy(lineupItem);
        const u = upperBounds[i] + beginningOffset;
        if (!isNil(u)) {
          let u2 = upperBound;
          if (!isNil(lineupItem.streamDuration)) {
            u2 = Math.min(u2, lineupItem.streamDuration);
          }
          lineupItem.streamDuration = Math.min(u2, u);
          upperBound = lineupItem.streamDuration;
        }
        serverCtx.channelCache.recordPlayback(
          redirectChannels[i],
          t0,
          lineupItem,
        );
      }
    }

    [
      '=========================================================',
      '! Start playback',
      `! Channel: ${channel.name} (${channel.number})`,
      `! Title: ${lineupItem?.title ?? 'Unknown'}`,
      isUndefined(lineupItem?.streamDuration)
        ? `! From: ${lineupItem?.start}`
        : `! From: ${lineupItem?.start} to: ${
            (lineupItem?.start ?? 0) + (lineupItem?.streamDuration ?? 0)
          }`,
      `! Type: ${lineupItem?.type}`,
      '=========================================================',
    ].forEach((line) => logger.info(line));

    if (!isLoading) {
      serverCtx.channelCache.recordPlayback(channel.uuid, t0, lineupItem!);
    }

    if (wereThereTooManyAttempts(session, lineupItem)) {
      lineupItem = {
        type: 'offline',
        err: Error('Too many attempts, throttling..'),
        duration: 60000,
        start: 0,
      };
    }

    const combinedChannel: ContextChannel = {
      ...generateChannelContext(channelContext),
      transcoding: channel.transcoding,
    };

    const playerContext: PlayerContext = {
      lineupItem: lineupItem!,
      ffmpegSettings: ffmpegSettings,
      channel: combinedChannel,
      m3u8: m3u8,
      audioOnly: audioOnly,
      // A little hacky...
      entityManager: (
        RequestContext.getEntityManager()! as EntityManager
      ).fork(),
      settings: serverCtx.settings,
    };

    const player: ProgramPlayer = new ProgramPlayer(playerContext);
    let stopped = false;

    const stop = () => {
      logger.info('Stop function hit...');
      if (!stopped) {
        stopped = true;
        player.cleanUp();
        // Unsure if this is right...
        outStream.push(null);
      }
    };

    // let playerObj: Maybe<TypedEventEmitter<FfmpegEvents>>;
    // res.header('Content-Type', 'video/mp2t');

    try {
      logger.info('About to play stream...');
      const ffmpegEmitter = await player.play(outStream);
      ffmpegEmitter?.on('error', (err) => {
        logger.error('Error while playing video: %O', err);
      });

      ffmpegEmitter?.on('end', () => {
        logger.debug('playObj.end');
        stop();
      });
    } catch (err) {
      logger.error('Error when attempting to play video: %O', err);
      stop();
      return {
        type: 'error',
        httpStatus: 500,
        message: 'Unable to start playing video.',
        error: err,
      };
      // return res.status(500).send('Unable to start playing video.');
    }

    const logTimer = once(() => {
      const dur = performance.now() - start;
      logger.debug('Video stream started in %d seconds', dur);
      outStream.off('data', logTimer);
    });
    outStream.on('data', logTimer);

    return {
      type: 'success',
      stream: outStream,
      stop,
    };
  }
}
