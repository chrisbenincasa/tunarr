import fastifyStatic from '@fastify/static';
import { Loaded } from '@mikro-orm/core';
import constants from '@tunarr/shared/constants';
import { FastifyReply, FastifyRequest } from 'fastify';
import { isNil, isUndefined, map, once } from 'lodash-es';
import * as fsSync from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'stream';
import { v4 } from 'uuid';
import { z } from 'zod';
import {
  StreamLineupItem,
  createOfflineStreamLineupIteam,
} from './dao/derived_types/StreamLineup.js';
import { Channel } from './dao/entities/Channel.js';
import { FFMPEG, FfmpegEvents } from './ffmpeg.js';
import { FfmpegText } from './ffmpegText.js';
import { serverOptions } from './globals.js';
import * as helperFuncs from './helperFuncs.js';
import createLogger from './logger.js';
import { ProgramPlayer } from './programPlayer.js';
import { serverContext } from './serverContext.js';
import { sessionManager } from './stream/sessionManager.js';
import { wereThereTooManyAttempts } from './throttler.js';
import { ContextChannel, Maybe, PlayerContext } from './types.js';
import { TypedEventEmitter } from './types/eventEmitter.js';
import { RouterPluginAsyncCallback } from './types/serverType.js';

const logger = createLogger(import.meta);

let StreamCount = 0;

const StreamQueryStringSchema = z.object({
  channel: z.coerce.number().optional(),
  m3u8: z.string().optional(),
  audioOnly: z.string().transform((s) => s === 'true'),
  session: z.coerce.number(),
  first: z.string().optional(),
});

type StreamQueryString = z.infer<typeof StreamQueryStringSchema>;

// eslint-disable-next-line @typescript-eslint/require-await
export const videoRouter: RouterPluginAsyncCallback = async (fastify) => {
  fastify.get('/setup', async (req, res) => {
    const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();
    // Check if ffmpeg path is valid
    if (!fsSync.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
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
    req: FastifyRequest<{ Querystring: { channel?: string } }>,
    res: FastifyReply,
    audioOnly: boolean,
  ) => {
    const reqId = `'conat-TOFB-${v4()}`;
    console.time(reqId);
    const ctx = await serverContext();
    // Check if channel queried is valid
    if (isUndefined(req.query.channel)) {
      return res.status(500).send('No Channel Specified');
    }

    const channel = await ctx.channelCache.getChannelConfig(
      parseInt(req.query.channel),
    );
    if (isNil(channel)) {
      return res.status(500).send("Channel doesn't exist");
    }

    void res.hijack();

    const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!fsSync.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
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

    ffmpeg.on('end', () => {
      logger.warn('FFMPEG END - FFMPEG CLOSE');
      logger.info(
        'Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.',
      );
      stop();
      res.raw.write(null);
    });

    res.raw.on('close', () => {
      logger.warn('RESPONSE CLOSE - FFMPEG CLOSE');
      // on HTTP close, kill ffmpeg
      logger.info(
        `\r\nStream ended. Channel: ${channel?.number} (${channel?.name})`,
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

    res.raw.writeHead(200, {
      'content-type': 'video/mp2t',
      'Access-Control-Allow-Origin': '*',
    });

    const onceListener = once(() => {
      console.timeEnd(reqId);
      ff.removeListener('data', onceListener);
    });

    ff.on('data', onceListener);

    ff.pipe(res.raw, { end: false });

    // return res.send(ff);
  };

  fastify.get<{ Querystring: { channel?: string } }>(
    '/video',
    async (req, res) => {
      return await concat(req, res, false);
    },
  );
  fastify.get<{ Querystring: { channel?: string } }>(
    '/radio',
    async (req, res) => {
      return await concat(req, res, true);
    },
  );

  // Stream individual video to ffmpeg concat above. This is used by the server, NOT the client
  const streamFunction = async (
    req: FastifyRequest,
    res: FastifyReply,
    query: StreamQueryString,
    t0: number,
    allowSkip: boolean,
  ): Promise<void> => {
    void res.header('Access-Control-Allow-Origin', '*');
    void res.hijack();
    // Check if channel queried is valid
    // res.on('error', (e) => {
    //   logger.error('There was an unexpected error in stream.', e);
    // });
    console.log(query);

    if (isUndefined(query.channel)) {
      return res.status(400).send('No Channel Specified');
    }

    const audioOnly = query.audioOnly;
    logger.info(`/stream audioOnly=${audioOnly}`);
    const session = query.session;
    const m3u8 = query.m3u8 === '1';
    const channel =
      await req.serverCtx.channelCache.getChannelConfigWithProgramsByNumber(
        query.channel,
      );

    if (isNil(channel)) {
      return res.status(404).send("Channel doesn't exist");
    }

    let isLoading = false;
    if (query.first === '0') {
      isLoading = true;
    }

    let isFirst = false;
    if (query.first === '1') {
      isFirst = true;
    }

    const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!fsSync.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
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
    let lineupItem: Maybe<StreamLineupItem> =
      req.serverCtx.channelCache.getCurrentLineupItem(channel.number, t0);
    let currentProgram: helperFuncs.ProgramAndTimeElapsed | undefined;
    let channelContext = channel;
    const redirectChannels: Loaded<Channel, 'programs'>[] = [];
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
      const lineup = await req.serverCtx.channelDB.loadLineup(channel.uuid);
      currentProgram = helperFuncs.getCurrentProgramAndTimeElapsed(
        t0,
        channel,
        lineup,
      );

      for (;;) {
        redirectChannels.push(channelContext);
        upperBounds.push(
          currentProgram.program.duration - currentProgram.timeElapsed,
        );

        if (
          // currentProgram.program.type !== 'offline'
          currentProgram.program.type !== 'redirect'
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

        const newChannelNumber = currentProgram.program.channel;
        const newChannel =
          await req.serverCtx.channelCache.getChannelConfigWithPrograms(
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
            lineup,
          );
        }
      }
    }

    if (isUndefined(lineupItem)) {
      if (isNil(currentProgram)) {
        return res.status(500).send('server error');
      }

      if (
        currentProgram.program.type === 'offline' &&
        channel.programs.length === 1 &&
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
          req.serverCtx.channelCache.clearPlayback(redirectChannels[i].number);
        }
        logger.info(
          'Too litlle time before the filler ends, skip to next slot',
        );
        return await streamFunction(req, res, query, t0 + dt + 1, false);
      }
      if (isNil(currentProgram) || isNil(currentProgram.program)) {
        throw "No video to play, this means there's a serious unexpected bug or the channel db is corrupted.";
      }
      const fillers = await req.serverCtx.fillerDB.getFillersFromChannel(
        channelContext.number,
      );
      const lineup = await helperFuncs.createLineup(
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
      entityManager: req.entityManager.fork(),
      settings: req.serverCtx.settings,
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

    res.raw.writeHead(200, {
      'content-type': 'video/mp2t',
      'Access-Control-Allow-Origin': '*',
    });

    try {
      logger.info('About to play stream...');
      playerObj = await player.play(res.raw);
    } catch (err) {
      logger.error('Error when attempting to play video: %O', err);
      stop();
      return res.status(500).send('Unable to start playing video.');
    }

    playerObj?.on('error', (err) => {
      logger.error('Error while playing video: %O', err);
    });

    playerObj?.on('end', () => {
      logger.debug('playObj.end');
      stop();
    });

    req.raw.on('close', () => {
      logger.debug('Client Closed');
      stop();
    });
  };

  fastify.get(
    '/stream',
    {
      schema: {
        querystring: StreamQueryStringSchema,
      },
      onError(req, _, e) {
        console.error(req.raw.url, e);
      },
    },
    async (req, res) => {
      const t0 = new Date().getTime();
      console.log(req.query);
      return await streamFunction(req, res, req.query, t0, true);
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

      const lines: string[] = [
        '#EXTM3U',
        '#EXT-X-VERSION:3',
        '#EXT-X-MEDIA-SEQUENCE:0',
        '#EXT-X-ALLOW-CACHE:YES',
        '#EXT-X-TARGETDURATION:60',
        '#EXT-X-PLAYLIST-TYPE:VOD',
        // `#EXT-X-STREAM-INF:BANDWIDTH=1123000`,
      ];

      const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();

      if (ffmpegSettings.enableTranscoding) {
        lines.push(
          `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&first=0&m3u8=1&session=${sessionId}`,
        );
      }
      lines.push(
        `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&first=1&m3u8=1&session=${sessionId}`,
      );
      for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
        lines.push(
          `${req.protocol}://${req.hostname}/stream?channel=${req.query.channel}&m3u8=1&session=${sessionId}`,
        );
      }

      return res.send(lines.join('\n'));
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

      const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();

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

    const content = [
      '#EXTM3U',
      '#EXT-X-VERSION:3',
      '#EXT-X-MEDIA-SEQUENCE:0',
      '#EXT-X-ALLOW-CACHE:YES',
      '#EXT-X-TARGETDURATION:60',
      '#EXT-X-PLAYLIST-TYPE:VOD',
      `${req.protocol}://${req.hostname}/${path}?channel=${channelNum}`,
    ];

    return res
      .type('video/x-mpegurl')
      .status(200)
      .send(content.join('\n') + '\n');
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

  fastify
    .register(fastifyStatic, {
      root: join(process.cwd(), 'streams'),
      decorateReply: false,
      prefix: '/streams/',
    })
    .decorateRequest('streamChannel', null)
    .addHook('onRequest', (req, res, done) => {
      const matches = req.url.match(/^\/streams\/stream_(.*)\/stream\.m3u8.*/);
      if (!isNil(matches) && matches.length > 1) {
        const query = req.query as Record<string, string>;
        const channelId = matches[1];
        req.streamChannel = channelId;
        const token = query['token'];
        const session = sessionManager.getSession(channelId);
        if (isNil(session)) {
          void res.status(404).send();
          return;
        }

        if (isNil(token)) {
          void res.status(400).send('Requires a token');
          return;
        }

        if (!session.isKnownConnection(token)) {
          void res.status(404).send('Unrecognized session token: ' + token);
        }

        session.recordHeartbeat(token);
      }
      done();
    })
    .addHook('onResponse', (req, res, done) => {
      const token = (req.query as Record<string, string>)['token'];
      if (
        res.statusCode === 200 &&
        !isNil(token) &&
        !isNil(req.streamChannel)
      ) {
        const session = sessionManager.getSession(req.streamChannel);
        if (!isNil(session) && session.isKnownConnection(token)) {
          session.recordHeartbeat(token);
        }
        // Keep track of active clients.
        // Parse out the channel ID from the request path
        // If we get an ID, reset the counter
        // console.log(req.url);
      }
      done();
    })
    .put('/streams/*', async (_, res) => {
      await res.send(200);
    });

  fastify.get(
    '/media-player/:number/hls',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelCache.getChannelConfig(
        req.params.number,
      );

      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const token = v4();

      const session = await sessionManager.getOrCreateSession(
        channel,
        req.serverCtx.settings.ffmpegSettings(),
        token,
        {
          ip: req.ip,
        },
      );

      if (isNil(session)) {
        return res.status(500).send('Error starting session');
      }

      return res.send({
        streamPath: `${session.streamPath}?token=${token}`,
      });
    },
  );

  fastify.get(
    '/media-player/:number/session',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelCache.getChannelConfig(
        req.params.number,
      );
      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const session = sessionManager.getSession(channel.uuid);

      return res.send({
        channelId: channel.uuid,
        channelNumber: channel.number,
        numConnections: session?.numConnections() ?? 0,
        connections: map(session?.connections(), (connection, token) => ({
          ...connection,
          lastHeartbeat: session?.lastHeartbeat(token),
        })),
      });
    },
  );

  fastify.delete(
    '/media-player/:number/session',
    {
      schema: {
        params: z.object({
          number: z.coerce.number(),
        }),
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelCache.getChannelConfig(
        req.params.number,
      );
      if (isNil(channel)) {
        return res.status(404).send("Channel doesn't exist");
      }

      const session = sessionManager.getSession(channel.uuid);

      if (isNil(session)) {
        return res.status(404).send('No sessions for channel');
      }

      session.stop();

      return res.send();
    },
  );
};
