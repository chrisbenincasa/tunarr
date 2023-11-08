import { FastifyPluginCallback, FastifyReply, FastifyRequest } from 'fastify';
import * as fs from 'node:fs';
import { isError, isNil, isUndefined, once } from 'lodash-es';
import { Readable } from 'stream';
import constants from './constants.js';
import { ImmutableChannel, offlineProgram } from './dao/db.js';
import { FFMPEG, FfmpegEvents } from './ffmpeg.js';
import { FfmpegText } from './ffmpegText.js';
import { serverOptions } from './globals.js';
import * as helperFuncs from './helperFuncs.js';
import createLogger from './logger.js';
import { ProgramPlayer } from './programPlayer.js';
import { serverContext } from './serverContext.js';
import { wereThereTooManyAttempts } from './throttler.js';
import {
  ContextChannel,
  LineupItem,
  Maybe,
  PlayerContext,
  TypedEventEmitter,
} from './types.js';

const logger = createLogger(import.meta);

let StreamCount = 0;

type StreamQueryString = {
  channel?: number;
  audioOnly: boolean;
  m3u8?: string;
  session: number;
  first?: string;
};

export const videoRouter: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.get('/setup', async (req, res) => {
    const ffmpegSettings = req.serverCtx.dbAccess.ffmpegSettings();
    // Check if ffmpeg path is valid
    if (!fs.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );

      return res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
    }

    logger.info(`\r\nStream starting. Channel: 1 (dizqueTV)`);

    const ffmpeg = new FfmpegText(
      ffmpegSettings,
      'dizqueTV (No Channels Configured)',
      'Configure your channels using the dizqueTV Web UI',
    );

    const buffer = new Readable();
    buffer._read = () => {};

    ffmpeg.on('data', (data) => {
      buffer.push(data);
    });

    ffmpeg.on('error', (err) => {
      logger.error('FFMPEG ERROR', err);
      buffer.push(null);
      void res.status(500).send('FFMPEG ERROR');
      return;
    });

    ffmpeg.on('close', () => {
      buffer.push(null);
    });

    res.raw.on('close', () => {
      // on HTTP close, kill ffmpeg
      ffmpeg.kill();
      logger.info(`\r\nStream ended. Channel: 1 (dizqueTV)`);
    });

    return res.send(buffer);
  });

  const concat = async (
    req: FastifyRequest<{ Querystring: { channel?: number } }>,
    res: FastifyReply,
    audioOnly: boolean,
  ) => {
    void res.hijack();
    const ctx = await serverContext();
    // Check if channel queried is valid
    if (isUndefined(req.query.channel)) {
      return res.status(500).send('No Channel Specified');
    }

    const channel = ctx.channelCache.getChannelConfig(req.query.channel);
    if (isUndefined(channel)) {
      return res.status(500).send("Channel doesn't exist");
    }

    const ffmpegSettings = req.serverCtx.dbAccess.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!fs.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );
      return res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
    }

    void res.header('Content-Type', 'video/mp2t');

    logger.info(
      `\r\nStream starting. Channel: ${channel.number} (${channel.name})`,
    );

    const ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    ffmpeg.setAudioOnly(audioOnly);

    const stop = once(() => {
      try {
        res.raw.end();
      } catch (err) {
        logger.error('error ending request', err);
      }
      ffmpeg.kill();
    });

    ffmpeg.on('error', (err) => {
      logger.error('CONCAT - FFMPEG ERROR', err);
      //status was already sent
      stop();
    });

    ffmpeg.on('close', () => {
      logger.warn('CONCAT - FFMPEG CLOSE');
    });

    res.raw.on('close', () => {
      logger.warn('RESPONSE CLOSE - FFMPEG CLOSE');
      // on HTTP close, kill ffmpeg
      logger.info(
        `\r\nStream ended. Channel: ${channel?.number} (${channel?.name})`,
      );
      stop();
    });

    ffmpeg.on('end', () => {
      logger.warn('FFMPEG END - FFMPEG CLOSE');
      logger.info(
        'Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.',
      );
      stop();
    });

    const ff = ffmpeg.spawnConcat(
      `http://localhost:${serverOptions().port}/playlist?channel=${
        req.query.channel
      }&audioOnly=${audioOnly}`,
    );

    if (isUndefined(ff)) {
      return res.status(500).send('Could not start concat stream');
    }

    ff.pipe(res.raw, { end: false });

    // return res.send(ff);
  };

  fastify.get<{ Querystring: { channel?: number } }>(
    '/video',
    async (req, res) => {
      return await concat(req, res, false);
    },
  );
  fastify.get<{ Querystring: { channel?: number } }>(
    '/radio',
    async (req, res) => {
      return await concat(req, res, true);
    },
  );

  // Stream individual video to ffmpeg concat above. This is used by the server, NOT the client
  const streamFunction = async (
    req: FastifyRequest<{
      Querystring: StreamQueryString;
    }>,
    res: FastifyReply,
    t0: number,
    allowSkip: boolean,
  ): Promise<void> => {
    void res.hijack();
    // Check if channel queried is valid
    // res.on('error', (e) => {
    //   logger.error('There was an unexpected error in stream.', e);
    // });

    if (isUndefined(req.query.channel)) {
      return res.status(400).send('No Channel Specified');
    }

    const audioOnly = req.query.audioOnly;
    logger.info(`/stream audioOnly=${audioOnly}`);
    const session = req.query.session;
    const m3u8 = req.query.m3u8 === '1';
    const channel = req.serverCtx.channelCache.getChannelConfig(
      req.query.channel,
    );

    if (isUndefined(channel)) {
      return res.status(404).send("Channel doesn't exist");
    }

    let isLoading = false;
    if (req.query.first === '0') {
      isLoading = true;
    }

    let isFirst = false;
    if (req.query.first === '1') {
      isFirst = true;
    }

    const ffmpegSettings = req.serverCtx.dbAccess.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!fs.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );

      return res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
    }

    // Get video lineup (array of video urls with calculated start times and durations.)
    let lineupItem: Maybe<LineupItem> =
      req.serverCtx.channelCache.getCurrentLineupItem(channel.number, t0);
    let currentProgram: helperFuncs.ProgramAndTimeElapsed | undefined;
    let channelContext = channel;
    const redirectChannels: ImmutableChannel[] = [];
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
      currentProgram = helperFuncs.getCurrentProgramAndTimeElapsed(t0, channel);

      for (;;) {
        redirectChannels.push(channelContext);
        upperBounds.push(
          currentProgram.program.duration - currentProgram.timeElapsed,
        );

        if (
          !currentProgram.program.isOffline ||
          currentProgram.program.type != 'redirect'
        ) {
          break;
        }

        req.serverCtx.channelCache.recordPlayback(channelContext.number, t0, {
          type: 'offline',
          title: 'Error',
          err: Error('Recursive channel redirect found'),
          duration: 60000,
          start: 0,
        });

        const newChannelNumber = currentProgram.program.channel!;
        const newChannel =
          req.serverCtx.channelCache.getChannelConfig(newChannelNumber);

        if (isUndefined(newChannel)) {
          const err = new Error(
            "Invalid redirect to a channel that doesn't exist",
          );
          logger.error("Invalid redirect to channel that doesn't exist.", err);
          currentProgram = {
            program: offlineProgram(60000),
            timeElapsed: 0,
            programIndex: -1,
          };
          continue;
        }

        channelContext = newChannel;
        lineupItem = req.serverCtx.channelCache.getCurrentLineupItem(
          newChannel.number,
          t0,
        );

        if (!isUndefined(lineupItem)) {
          lineupItem = { ...lineupItem }; // Not perfect, but better than the stringify hack
          break;
        } else {
          currentProgram = helperFuncs.getCurrentProgramAndTimeElapsed(
            t0,
            newChannel,
          );
        }
      }
    }

    if (isUndefined(lineupItem)) {
      if (isNil(currentProgram)) {
        return res.status(500).send('server error');
      }

      if (
        currentProgram.program.isOffline &&
        channel.programs.length === 1 &&
        currentProgram.programIndex !== -1
      ) {
        //there's only one program and it's offline. So really, the channel is
        //permanently offline, it doesn't matter what duration was set
        //and it's best to give it a long duration to ensure there's always
        //filler to play (if any)
        const t = 365 * 24 * 60 * 60 * 1000;
        currentProgram.program = offlineProgram(t);
      } else if (
        allowSkip &&
        currentProgram.program.isOffline &&
        currentProgram.program.duration - currentProgram.timeElapsed <=
          constants.SLACK + 1
      ) {
        //it's pointless to show the offline screen for such a short time, might as well
        //skip to the next program
        const dt = currentProgram.program.duration - currentProgram.timeElapsed;
        for (let i = 0; i < redirectChannels.length; i++) {
          req.serverCtx.channelCache.clearPlayback(redirectChannels[i].number);
        }
        logger.info(
          'Too litlle time before the filler ends, skip to next slot',
        );
        return await streamFunction(req, res, t0 + dt + 1, false);
      }
      if (isNil(currentProgram) || isNil(currentProgram.program)) {
        throw "No video to play, this means there's a serious unexpected bug or the channel db is corrupted.";
      }
      const fillers =
        req.serverCtx.fillerDB.getFillersFromChannel(channelContext);
      const lineup = helperFuncs.createLineup(
        req.serverCtx.channelCache,
        currentProgram,
        channelContext,
        fillers,
        isFirst,
      );
      lineupItem = lineup.shift();
    }

    if (!isLoading && !isUndefined(lineupItem)) {
      let upperBound = Number.MAX_SAFE_INTEGER;
      let beginningOffset = 0;
      if (!isUndefined(lineupItem?.beginningOffset)) {
        beginningOffset = lineupItem.beginningOffset;
      }
      //adjust upper bounds and record playbacks
      for (let i = redirectChannels.length - 1; i >= 0; i--) {
        lineupItem = { ...lineupItem };
        const u = upperBounds[i] + beginningOffset;
        if (!isNil(u)) {
          let u2 = upperBound;
          if (!isNil(lineupItem.streamDuration)) {
            u2 = Math.min(u2, lineupItem.streamDuration);
          }
          lineupItem.streamDuration = Math.min(u2, u);
          upperBound = lineupItem.streamDuration;
        }
        req.serverCtx.channelCache.recordPlayback(
          redirectChannels[i].number,
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
      req.serverCtx.channelCache.recordPlayback(
        channel.number,
        t0,
        lineupItem!,
      );
    }
    if (wereThereTooManyAttempts(session, lineupItem)) {
      lineupItem = {
        type: 'offline',
        // isOffline: true,
        err: Error('Too many attempts, throttling..'),
        duration: 60000,
        start: 0,
      };
    }

    const combinedChannel: ContextChannel = {
      ...helperFuncs.generateChannelContext(channelContext),
      transcoding: channel.transcoding,
    };

    const playerContext: PlayerContext = {
      lineupItem: lineupItem!,
      ffmpegSettings: ffmpegSettings,
      channel: combinedChannel,
      m3u8: m3u8,
      audioOnly: audioOnly,
      dbAccess: req.serverCtx.dbAccess,
    };

    let player: ProgramPlayer | null = new ProgramPlayer(playerContext);
    let stopped = false;
    const stop = () => {
      logger.info('Stop function hit...');
      if (!stopped) {
        stopped = true;
        player?.cleanUp();
        player = null;
        // Unsure if this is right...
        res.raw.end();
      }
    };

    let playerObj: Maybe<TypedEventEmitter<FfmpegEvents>>;
    void res.header('Content-Type', 'video/mp2t');

    try {
      logger.info('About to play stream...');
      playerObj = await player.play(res.raw);
    } catch (err) {
      if (isError(err)) {
        logger.error('Error when attempting to play video', err);
      } else {
        logger.error('Error when attempting to play video ' + err);
      }
      try {
        return res.status(500).send('Unable to start playing video.');
      } catch (err2) {
        if (isError(err2)) {
          logger.error('error', err2.stack);
        } else {
          logger.error('Unknown error ' + err2);
        }
      }
      stop();
      return res; // Unclear if this is correct
    }

    playerObj?.on('end', () => {
      logger.info('playObj.end');
      stop();
    });

    req.raw.on('close', () => {
      logger.info('Client Closed');
      stop();
    });
  };

  fastify.get<{ Querystring: StreamQueryString }>(
    '/stream',
    async (req, res) => {
      const t0 = new Date().getTime();
      void res.header('keep-alive', 'timeout=10000');
      return await streamFunction(req, res, t0, true);
    },
  );

  fastify.get<{ Querystring: { channel?: number } }>(
    '/m3u8',
    async (req, res) => {
      const sessionId = StreamCount++;

      //res.type('application/vnd.apple.mpegurl')
      void res.type('application/x-mpegURL');

      // Check if channel queried is valid
      if (isUndefined(req.query.channel)) {
        return res.status(500).send('No Channel Specified');
      }

      const channel = req.serverCtx.channelCache.getChannelConfig(
        req.query.channel,
      );
      if (isUndefined(channel)) {
        return res.status(500).send("Channel doesn't exist");
      }

      // Maximum number of streams to concatinate beyond channel starting
      // If someone passes this number then they probably watch too much television
      const maxStreamsToPlayInARow = 100;

      let data = '#EXTM3U\n';

      data += `#EXT-X-VERSION:3
        #EXT-X-MEDIA-SEQUENCE:0
        #EXT-X-ALLOW-CACHE:YES
        #EXT-X-TARGETDURATION:60
        #EXT-X-PLAYLIST-TYPE:VOD\n`;

      const ffmpegSettings = req.serverCtx.dbAccess.ffmpegSettings();

      // let cur = '59.0';

      if (ffmpegSettings.enableTranscoding) {
        //data += `#EXTINF:${cur},\n`;
        data += `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&first=0&m3u8=1&session=${sessionId}\n`;
      }
      //data += `#EXTINF:${cur},\n`;
      data += `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&first=1&m3u8=1&session=${sessionId}\n`;
      for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
        //data += `#EXTINF:${cur},\n`;
        data += `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&m3u8=1&session=${sessionId}\n`;
      }

      return res.send(data);
    },
  );

  fastify.get<{ Querystring: { channel?: number; audioOnly?: boolean } }>(
    '/playlist',
    async (req, res) => {
      void res.type('text');

      // Check if channel queried is valid
      if (isUndefined(req.query.channel)) {
        return res.status(500).send('No Channel Specified');
      }

      const channel = req.serverCtx.channelCache.getChannelConfig(
        req.query.channel,
      );
      if (isUndefined(channel)) {
        return res.status(500).send("Channel doesn't exist");
      }

      // Maximum number of streams to concatinate beyond channel starting
      // If someone passes this number then they probably watch too much television
      // TODO: Make this an option - who cares how much TV people watch :)
      const maxStreamsToPlayInARow = 100;

      let data = 'ffconcat version 1.0\n';

      const ffmpegSettings = req.serverCtx.dbAccess.ffmpegSettings();

      const sessionId = StreamCount++;
      const audioOnly = req.query.audioOnly;

      // loading screen is pointless in audio mode (also for some reason it makes it fail when codec is aac, and I can't figure out why)
      if (
        ffmpegSettings.enableTranscoding &&
        ffmpegSettings.normalizeVideoCodec &&
        ffmpegSettings.normalizeAudioCodec &&
        ffmpegSettings.normalizeResolution &&
        ffmpegSettings.normalizeAudio &&
        !audioOnly
      ) {
        //loading screen
        data += `file 'http://localhost:${
          serverOptions().port
        }/stream?channel=${
          req.query.channel
        }&first=0&session=${sessionId}&audioOnly=${audioOnly}'\n`;
      }

      data += `file 'http://localhost:${serverOptions().port}/stream?channel=${
        req.query.channel
      }&first=1&session=${sessionId}&audioOnly=${audioOnly}'\n`;

      for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
        data += `file 'http://localhost:${
          serverOptions().port
        }/stream?channel=${
          req.query.channel
        }&session=${sessionId}&audioOnly=${audioOnly}'\n`;
      }

      return res.send(data);
    },
  );

  const mediaPlayer = async (
    channelNum: number,
    path: string,
    req: FastifyRequest,
    res: FastifyReply,
  ) => {
    const channel = req.serverCtx.channelCache.getChannelConfig(channelNum);
    if (isUndefined(channel)) {
      return res.status(404).send('Channel not found.');
    }

    return res
      .type('video/x-mpegurl')
      .status(200)
      .send(
        `#EXTM3U\n${req.protocol}://${req.hostname}/${path}?channel=${channelNum}\n\n`,
      );
  };

  fastify.get<{ Params: { number: number }; Querystring: { fast?: string } }>(
    '/media-player/:number.m3u',
    async (req, res) => {
      try {
        let path = 'video';
        if (req.query.fast === '1') {
          path = 'm3u8';
        }
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  fastify.get<{ Params: { number: number } }>(
    '/media-player/fast/:number.m3u',
    async (req, res) => {
      try {
        const path = 'm3u8';
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  fastify.get<{ Params: { number: number } }>(
    '/media-player/radio/:number.m3u',
    async (req, res) => {
      try {
        const path = 'radio';
        return await mediaPlayer(req.params.number, path, req, res);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('There was an error.');
      }
    },
  );

  done();
};
