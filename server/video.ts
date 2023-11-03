import express, { Request, Response } from 'express';
import fs from 'fs';
import { isUndefined } from 'lodash-es';
import constants from './constants.js';
import { ImmutableChannel, offlineProgram } from './dao/db.js';
import { FFMPEG } from './ffmpeg.js';
import { FfmpegText } from './ffmpegText.js';
import { serverOptions } from './globals.js';
import * as helperFuncs from './helperFuncs.js';
import createLogger from './logger.js';
import { ProgramPlayer } from './programPlayer.js';
import { serverContext } from './serverContext.js';
import { wereThereTooManyAttempts } from './throttler.js';
import { ContextChannel, LineupItem, Maybe, PlayerContext } from './types.js';

const logger = createLogger(import.meta);

let StreamCount = 0;

export function video(fillerDB) {
  const router = express.Router();

  router.get('/setup', (req, res) => {
    const ffmpegSettings = req.ctx.dbAccess.ffmpegSettings();
    // Check if ffmpeg path is valid
    if (!fs.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );
      return;
    }

    logger.info(`\r\nStream starting. Channel: 1 (dizqueTV)`);

    const ffmpeg = new FfmpegText(
      ffmpegSettings,
      'dizqueTV (No Channels Configured)',
      'Configure your channels using the dizqueTV Web UI',
    );

    ffmpeg.on('data', (data) => {
      res.write(data);
    });

    ffmpeg.on('error', (err) => {
      logger.error('FFMPEG ERROR', err);
      res.status(500).send('FFMPEG ERROR');
      return;
    });
    ffmpeg.on('close', () => {
      res.end();
    });

    res.on('close', () => {
      // on HTTP close, kill ffmpeg
      ffmpeg.kill();
      logger.info(`\r\nStream ended. Channel: 1 (dizqueTV)`);
    });
  });
  // Continuously stream video to client. Leverage ffmpeg concat for piecing together videos
  const concat = async (req: Request, res, audioOnly) => {
    const ctx = await serverContext();
    // Check if channel queried is valid
    if (isUndefined(req.query.channel)) {
      res.status(500).send('No Channel Specified');
      return;
    }
    const number = parseInt(req.query.channel as string, 10);
    const channel = await ctx.channelCache.getChannelConfig(number);
    if (isUndefined(channel)) {
      res.status(500).send("Channel doesn't exist");
      return;
    }

    const ffmpegSettings = req.ctx.dbAccess.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!fs.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
    });

    logger.info(
      `\r\nStream starting. Channel: ${channel.number} (${channel.name})`,
    );

    const ffmpeg = new FFMPEG(ffmpegSettings, channel); // Set the transcoder options
    ffmpeg.setAudioOnly(audioOnly);
    let stopped = false;

    function stop() {
      if (!stopped) {
        stopped = true;
        try {
          res.end();
        } catch (err) {}
        ffmpeg.kill();
      }
    }

    ffmpeg.on('error', (err) => {
      logger.error('FFMPEG ERROR', err);
      //status was already sent
      stop();
      return;
    });

    ffmpeg.on('close', stop);

    res.on('close', () => {
      // on HTTP close, kill ffmpeg
      logger.info(
        `\r\nStream ended. Channel: ${channel?.number} (${channel?.name})`,
      );
      stop();
    });

    ffmpeg.on('end', () => {
      logger.info(
        'Video queue exhausted. Either you played 100 different clips in a row or there were technical issues that made all of the possible 100 attempts fail.',
      );
      stop();
    });

    const channelNum = parseInt(req.query.channel as string, 10);
    const ff = await ffmpeg.spawnConcat(
      `http://localhost:${
        serverOptions().port
      }/playlist?channel=${channelNum}&audioOnly=${audioOnly}`,
    );
    ff?.pipe(res);
  };
  router.get('/video', async (req, res) => {
    return await concat(req, res, false);
  });
  router.get('/radio', async (req, res) => {
    return await concat(req, res, true);
  });

  // Stream individual video to ffmpeg concat above. This is used by the server, NOT the client
  const streamFunction = async (
    req: Request,
    res: Response,
    t0: number,
    allowSkip: boolean,
  ) => {
    const ctx = await serverContext();
    // Check if channel queried is valid
    res.on('error', (e) => {
      logger.error('There was an unexpected error in stream.', e);
    });
    if (isUndefined(req.query.channel)) {
      res.status(400).send('No Channel Specified');
      return;
    }

    const audioOnly = 'true' == req.query.audioOnly;
    logger.info(`/stream audioOnly=${audioOnly}`);
    const session = parseInt(req.query.session as string);
    const m3u8 = req.query.m3u8 === '1';
    const number = parseInt(req.query.channel as string);
    const channel = await ctx.channelCache.getChannelConfig(number);

    if (isUndefined(channel)) {
      res.status(404).send("Channel doesn't exist");
      return;
    }
    let isLoading = false;
    if (typeof req.query.first !== 'undefined' && req.query.first == '0') {
      isLoading = true;
    }

    let isFirst = false;
    if (typeof req.query.first !== 'undefined' && req.query.first == '1') {
      isFirst = true;
    }

    const ffmpegSettings = req.ctx.dbAccess.ffmpegSettings();

    // Check if ffmpeg path is valid
    if (!fs.existsSync(ffmpegSettings.ffmpegExecutablePath)) {
      res
        .status(500)
        .send(
          `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
        );
      logger.error(
        `FFMPEG path (${ffmpegSettings.ffmpegExecutablePath}) is invalid. The file (executable) doesn't exist.`,
      );
      return;
    }

    // Get video lineup (array of video urls with calculated start times and durations.)
    let lineupItem: Maybe<LineupItem> = ctx.channelCache.getCurrentLineupItem(
      channel.number,
      t0,
    );
    let prog: helperFuncs.ProgramAndTimeElapsed | undefined;
    let brandChannel = channel;
    const redirectChannels: ImmutableChannel[] = [];
    const upperBounds: number[] = [];

    if (isLoading) {
      lineupItem = {
        type: 'loading',
        streamDuration: 40,
        duration: 40,
        start: 0,
      };
    } else if (isUndefined(lineupItem)) {
      prog = helperFuncs.getCurrentProgramAndTimeElapsed(t0, channel);

      while (true) {
        redirectChannels.push(brandChannel);
        upperBounds.push(prog.program.duration - prog.timeElapsed);

        if (!prog.program.isOffline || prog.program.type != 'redirect') {
          break;
        }
        ctx.channelCache.recordPlayback(brandChannel.number, t0, {
          type: 'offline',
          title: 'Error',
          err: Error('Recursive channel redirect found'),
          duration: 60000,
          start: 0,
        });

        const newChannelNumber = prog.program.channel!;
        const newChannel =
          await ctx.channelCache.getChannelConfig(newChannelNumber);

        if (isUndefined(newChannel)) {
          const err = Error("Invalid redirect to a channel that doesn't exist");
          logger.error("Invalid redirect to channel that doesn't exist.", err);
          prog = {
            program: offlineProgram(60000),
            // program: {
            //   isOffline: true,
            //   err: err,
            //   duration: 60000,
            // },
            timeElapsed: 0,
            programIndex: -1,
          };
          continue;
        }
        brandChannel = newChannel;
        lineupItem = ctx.channelCache.getCurrentLineupItem(
          newChannel.number,
          t0,
        );
        if (!isUndefined(lineupItem)) {
          lineupItem = { ...lineupItem }; // Not perfect, but better than the stringify hack
          break;
        } else {
          prog = helperFuncs.getCurrentProgramAndTimeElapsed(t0, newChannel);
        }
      }
    }
    if (isUndefined(lineupItem)) {
      if (prog == null) {
        res.status(500).send('server error');
        throw Error("Shouldn't prog be non-null?");
      }
      if (
        prog.program.isOffline &&
        channel.programs.length == 1 &&
        prog.programIndex != -1
      ) {
        //there's only one program and it's offline. So really, the channel is
        //permanently offline, it doesn't matter what duration was set
        //and it's best to give it a long duration to ensure there's always
        //filler to play (if any)
        const t = 365 * 24 * 60 * 60 * 1000;
        prog.program = offlineProgram(t);
      } else if (
        allowSkip &&
        prog.program.isOffline &&
        prog.program.duration - prog.timeElapsed <= constants.SLACK + 1
      ) {
        //it's pointless to show the offline screen for such a short time, might as well
        //skip to the next program
        const dt = prog.program.duration - prog.timeElapsed;
        for (let i = 0; i < redirectChannels.length; i++) {
          ctx.channelCache.clearPlayback(redirectChannels[i].number);
        }
        logger.info(
          'Too litlle time before the filler ends, skip to next slot',
        );
        return await streamFunction(req, res, t0 + dt + 1, false);
      }
      if (
        prog == null ||
        isUndefined(prog) ||
        prog.program == null ||
        typeof prog.program == 'undefined'
      ) {
        throw "No video to play, this means there's a serious unexpected bug or the channel db is corrupted.";
      }
      const fillers = await fillerDB.getFillersFromChannel(brandChannel);
      const lineup = helperFuncs.createLineup(
        ctx.channelCache,
        prog,
        brandChannel,
        fillers,
        isFirst,
      );
      lineupItem = lineup.shift();
    }

    if (!isLoading && !isUndefined(lineupItem)) {
      let upperBound = 1000000000;
      let beginningOffset = 0;
      if (!isUndefined(lineupItem?.beginningOffset)) {
        beginningOffset = lineupItem.beginningOffset;
      }
      //adjust upper bounds and record playbacks
      for (let i = redirectChannels.length - 1; i >= 0; i--) {
        lineupItem = { ...lineupItem };
        const u = upperBounds[i] + beginningOffset;
        if (typeof u !== 'undefined') {
          let u2 = upperBound;
          if (typeof lineupItem.streamDuration !== 'undefined') {
            u2 = Math.min(u2, lineupItem.streamDuration);
          }
          lineupItem.streamDuration = Math.min(u2, u);
          upperBound = lineupItem.streamDuration;
        }
        ctx.channelCache.recordPlayback(
          redirectChannels[i].number,
          t0,
          lineupItem,
        );
      }
    }

    logger.info('=========================================================');
    logger.info('! Start playback');
    logger.info(`! Channel: ${channel.name} (${channel.number})`);
    if (!isUndefined(lineupItem?.title)) {
      lineupItem!.title = 'Unknown';
    }
    logger.info(`! Title: ${lineupItem?.title}`);
    if (isUndefined(lineupItem?.streamDuration)) {
      logger.info(`! From : ${lineupItem?.start}`);
    } else {
      logger.info(
        `! From : ${lineupItem?.start} to: ${
          (lineupItem?.start ?? 0) + (lineupItem?.streamDuration ?? 0)
        }`,
      );
    }
    logger.info('=========================================================');

    if (!isLoading) {
      ctx.channelCache.recordPlayback(channel.number, t0, lineupItem!);
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
      ...helperFuncs.generateChannelContext(brandChannel),
      transcoding: channel.transcoding,
    };

    const playerContext: PlayerContext = {
      lineupItem: lineupItem!,
      ffmpegSettings: ffmpegSettings,
      channel: combinedChannel,
      m3u8: m3u8,
      audioOnly: audioOnly,
      dbAccess: req.ctx.dbAccess,
    };

    let player: ProgramPlayer | null = new ProgramPlayer(playerContext);
    let stopped = false;
    const stop = () => {
      if (!stopped) {
        stopped = true;
        player?.cleanUp();
        player = null;
        res.end();
      }
    };
    let playerObj: any = null;
    res.writeHead(200, {
      'Content-Type': 'video/mp2t',
    });

    try {
      playerObj = await player.play(res);
    } catch (err) {
      logger.info('Error when attempting to play video: ' + err.stack);
      try {
        res.status(500).send('Unable to start playing video.').end();
      } catch (err2) {
        logger.info(err2.stack);
      }
      stop();
      return;
    }

    const stream = playerObj;

    // res.write(playerObj.data);

    stream.on('end', () => {
      stop();
    });
    res.on('close', () => {
      logger.info('Client Closed');
      stop();
    });
  };

  router.get('/stream', async (req, res) => {
    const t0 = new Date().getTime();
    return await streamFunction(req, res, t0, true);
  });

  router.get('/m3u8', async (req, res) => {
    const ctx = await serverContext();
    const sessionId = StreamCount++;

    //res.type('application/vnd.apple.mpegurl')
    res.type('application/x-mpegURL');

    // Check if channel queried is valid
    if (isUndefined(req.query.channel)) {
      res.status(500).send('No Channel Specified');
      return;
    }

    const channelNum = parseInt(req.query.channel as string, 10);
    const channel = await ctx.channelCache.getChannelConfig(channelNum);
    if (isUndefined(channel)) {
      res.status(500).send("Channel doesn't exist");
      return;
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

    const ffmpegSettings = req.ctx.dbAccess.ffmpegSettings();

    // let cur = '59.0';

    if (ffmpegSettings.enableTranscoding) {
      //data += `#EXTINF:${cur},\n`;
      data += `${req.protocol}://${req.get(
        'host',
      )}/stream?channel=${channelNum}&first=0&m3u8=1&session=${sessionId}\n`;
    }
    //data += `#EXTINF:${cur},\n`;
    data += `${req.protocol}://${req.get(
      'host',
    )}/stream?channel=${channelNum}&first=1&m3u8=1&session=${sessionId}\n`;
    for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
      //data += `#EXTINF:${cur},\n`;
      data += `${req.protocol}://${req.get(
        'host',
      )}/stream?channel=${channelNum}&m3u8=1&session=${sessionId}\n`;
    }

    res.send(data);
  });
  router.get('/playlist', async (req, res) => {
    const ctx = await serverContext();
    res.type('text');

    // Check if channel queried is valid
    if (isUndefined(req.query.channel)) {
      res.status(500).send('No Channel Specified');
      return;
    }

    const channelNum = parseInt(req.query.channel as string, 10);
    const channel = await ctx.channelCache.getChannelConfig(channelNum);
    if (isUndefined(channel)) {
      res.status(500).send("Channel doesn't exist");
      return;
    }

    // Maximum number of streams to concatinate beyond channel starting
    // If someone passes this number then they probably watch too much television
    const maxStreamsToPlayInARow = 100;

    let data = 'ffconcat version 1.0\n';

    const ffmpegSettings = req.ctx.dbAccess.ffmpegSettings();

    const sessionId = StreamCount++;
    const audioOnly = 'true' == req.query.audioOnly;

    if (
      ffmpegSettings.enableTranscoding === true &&
      ffmpegSettings.normalizeVideoCodec === true &&
      ffmpegSettings.normalizeAudioCodec === true &&
      ffmpegSettings.normalizeResolution === true &&
      ffmpegSettings.normalizeAudio === true &&
      audioOnly !==
        true /* loading screen is pointless in audio mode (also for some reason it makes it fail when codec is aac, and I can't figure out why) */
    ) {
      //loading screen
      data += `file 'http://localhost:${
        serverOptions().port
      }/stream?channel=${channelNum}&first=0&session=${sessionId}&audioOnly=${audioOnly}'\n`;
    }
    data += `file 'http://localhost:${
      serverOptions().port
    }/stream?channel=${channelNum}&first=1&session=${sessionId}&audioOnly=${audioOnly}'\n`;
    for (let i = 0; i < maxStreamsToPlayInARow - 1; i++) {
      data += `file 'http://localhost:${
        serverOptions().port
      }/stream?channel=${channelNum}&session=${sessionId}&audioOnly=${audioOnly}'\n`;
    }

    res.send(data);
  });

  const mediaPlayer = async (channelNum, path, req, res) => {
    const ctx = await serverContext();
    const channel = await ctx.channelCache.getChannelConfig(channelNum);
    if (isUndefined(channel)) {
      res.status(404).send('Channel not found.');
      return;
    }
    res.type('video/x-mpegurl');
    res
      .status(200)
      .send(
        `#EXTM3U\n${req.protocol}://${req.get(
          'host',
        )}/${path}?channel=${channelNum}\n\n`,
      );
  };

  router.get('/media-player/:number.m3u', async (req, res) => {
    try {
      const channelNum = parseInt(req.params.number, 10);
      let path = 'video';
      if (req.query.fast === '1') {
        path = 'm3u8';
      }
      return await mediaPlayer(channelNum, path, req, res);
    } catch (err) {
      logger.error(err);
      res.status(500).send('There was an error.');
    }
  });

  router.get('/media-player/fast/:number.m3u', async (req, res) => {
    try {
      const channelNum = parseInt(req.params.number, 10);
      const path = 'm3u8';
      return await mediaPlayer(channelNum, path, req, res);
    } catch (err) {
      logger.error(err);
      res.status(500).send('There was an error.');
    }
  });

  router.get('/media-player/radio/:number.m3u', async (req, res) => {
    try {
      const channelNum = parseInt(req.params.number, 10);
      const path = 'radio';
      return await mediaPlayer(channelNum, path, req, res);
    } catch (err) {
      logger.error(err);
      res.status(500).send('There was an error.');
    }
  });

  return router;
}
