import JSONStream from 'JSONStream';
import express from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import { find, isUndefined, omit } from 'lodash-es';
import path from 'path';
import constants from './constants.js';
import { Channel, getDB } from './dao/db.js';
import { PlexServerDB } from './dao/plex-server-db.js';
import * as databaseMigration from './database-migration.js';
import { FFMPEGInfo } from './ffmpeg-info.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { Plex } from './plex.js';
import randomSlotsService from './services/random-slots-service.js';
import throttle from './services/throttle.js';
import timeSlotsService from './services/time-slots-service.js';
import { serverContext } from './server-context.js';
import { ChannelDB } from './dao/channel-db.js';
import { TVGuideService } from './services/tv-guide-service.js';
import { M3uService } from './services/m3u-service.js';
import { EventService } from './services/event-service.js';
import { ChannelCache } from './channel-cache.js';
import { CustomShowDB } from './dao/custom-show-db.js';
import { FillerDB } from './dao/filler-db.js';

const logger = createLogger(import.meta);

function safeString(object, ...args: any[]) {
  let o = object;
  for (let i = 0; i < args.length; i++) {
    o = o[arguments[i]];
    if (isUndefined(o)) {
      return 'missing';
    }
  }
  return String(o);
}

export function makeApi(
  db,
  channelDB: ChannelDB,
  fillerDB: FillerDB,
  customShowDB: CustomShowDB,
  xmltvInterval,
  guideService: TVGuideService,
  _m3uService: M3uService,
  eventService: EventService,
  channelCache: ChannelCache,
) {
  let m3uService = _m3uService;
  const router = express.Router();
  const plexServerDB = new PlexServerDB(
    channelDB,
    channelCache,
    fillerDB,
    customShowDB,
    db,
  );

  router.get('/api/version', async (_, res) => {
    try {
      let ffmpegSettings = db['ffmpeg-settings'].find()[0];
      let v = await new FFMPEGInfo(ffmpegSettings).getVersion();
      res.send({
        dizquetv: constants.VERSION_NAME,
        ffmpeg: v,
        nodejs: process.version,
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  // Plex Servers
  router.get('/api/plex-servers', async (_, res) => {
    try {
      const db = await getDB();
      res.json(db.plexServers());
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.post('/api/plex-servers/status', async (req, res) => {
    try {
      let servers = db['plex-servers'].find({
        name: req.body.name,
      });
      if (servers.length != 1) {
        res.status(404).send('Plex server not found.');
      }
      let plex = new Plex(servers[0]);
      let s = await Promise.race([
        (async () => {
          return await plex.checkServerStatus();
        })(),
        new Promise((resolve, _) => {
          setTimeout(() => {
            resolve(-1);
          }, 60000);
        }),
      ]);
      res.send({
        status: s,
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.post('/api/plex-servers/foreignstatus', async (req, res) => {
    try {
      let server = req.body;
      let plex = new Plex(server);
      let s = await Promise.race([
        (async () => {
          return await plex.checkServerStatus();
        })(),
        new Promise((resolve, _reject) => {
          setTimeout(() => {
            resolve(-1);
          }, 60000);
        }),
      ]);
      res.send({
        status: s,
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.delete('/api/plex-servers', async (req, res) => {
    let name = 'unknown';
    try {
      name = req.body.name;
      if (isUndefined(name)) {
        res.status(400).send('Missing name');
      }
      let report = await plexServerDB.deleteServer(name);
      res.send(report);
      eventService.push('settings-update', {
        message: `Plex server ${name} removed.`,
        module: 'plex-server',
        detail: {
          serverName: name,
          action: 'delete',
        },
        level: 'warn',
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error deleting plex server.',
        module: 'plex-server',
        detail: {
          action: 'delete',
          serverName: name,
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });
  router.post('/api/plex-servers', async (req, res) => {
    try {
      let report = await plexServerDB.updateServer(req.body);
      let modifiedPrograms = 0;
      let destroyedPrograms = 0;
      report.forEach((r) => {
        modifiedPrograms += r.modifiedPrograms;
        destroyedPrograms += r.destroyedPrograms;
      });
      res.status(204).send('Plex server updated.');
      eventService.push('settings-update', {
        message: `Plex server ${req.body.name} updated. ${modifiedPrograms} programs modified, ${destroyedPrograms} programs deleted`,
        module: 'plex-server',
        detail: {
          serverName: req.body.name,
          action: 'update',
        },
        level: 'warning',
      });
    } catch (err) {
      logger.error('Could not update plex server.', err);
      res.status(400).send('Could not add plex server.');
      eventService.push('settings-update', {
        message: 'Error updating plex server.',
        module: 'plex-server',
        detail: {
          action: 'update',
          serverName: safeString(req, 'body', 'name'),
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });
  router.put('/api/plex-servers', async (req, res) => {
    try {
      await plexServerDB.addServer(req.body);
      res.status(201).send('Plex server added.');
      eventService.push('settings-update', {
        message: `Plex server ${req.body.name} added.`,
        module: 'plex-server',
        detail: {
          serverName: req.body.name,
          action: 'add',
        },
        level: 'info',
      });
    } catch (err) {
      logger.error('Could not add plex server.', err);
      res.status(400).send('Could not add plex server.');
      eventService.push('settings-update', {
        message: 'Error adding plex server.',
        module: 'plex-server',
        detail: {
          action: 'add',
          serverName: safeString(req, 'body', 'name'),
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });

  // Channels
  router.get('/api/channels', async (_req, res) => {
    try {
      let channels = await channelDB.getAllChannels();
      channels.sort((a, b) => {
        return a.number < b.number ? -1 : 1;
      });
      res.send(channels);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.get('/api/channel/:number', async (req, res) => {
    try {
      const ctx = await serverContext();
      let number = parseInt(req.params.number, 10);
      let channel = await ctx.channelCache.getChannelConfig(number);

      if (!isUndefined(channel)) {
        res.json(channel);
      } else {
        res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.get('/api/channel/programless/:number', async (req, res) => {
    try {
      const ctx = await serverContext();
      let number = parseInt(req.params.number, 10);
      let channel = await ctx.channelCache.getChannelConfig(number);

      if (!isUndefined(channel)) {
        res.json(omit({ ...channel }, 'programs'));
      } else {
        res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.get('/api/channel/programs/:number', async (req, res) => {
    try {
      const ctx = await serverContext();
      let number = parseInt(req.params.number, 10);
      let channel = await ctx.channelCache.getChannelConfig(number);

      if (!isUndefined(channel)) {
        let programs = channel.programs;
        if (isUndefined(programs)) {
          res.status(404).send("Channel doesn't have programs?");
        }
        res.writeHead(200, {
          'Content-Type': 'application/json',
        });

        let transformStream = JSONStream.stringify();
        transformStream.pipe(res);

        for (let i = 0; i < programs.length; i++) {
          transformStream.write(programs[i]);
          await throttle();
        }
        transformStream.end();
      } else {
        res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.get('/api/channel/description/:number', async (req, res) => {
    try {
      const ctx = await serverContext();
      let number = parseInt(req.params.number, 10);
      let channel = await ctx.channelCache.getChannelConfig(number);
      if (!isUndefined(channel)) {
        res.send({
          number: channel.number,
          icon: channel.icon,
          name: channel.name,
          stealth: channel.stealth,
        });
      } else {
        res.status(404).send('Channel not found');
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.get('/api/channelNumbers', async (_req, res) => {
    try {
      let channels = await channelDB.getAllChannelNumbers();
      res.send(channels);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.post('/api/channel', async (req, res) => {
    try {
      const ctx = await serverContext();
      await m3uService.clearCache();
      cleanUpChannel(req.body);
      await channelDB.saveChannel(req.body as Channel);
      ctx.channelCache.clear();
      res.send({ number: req.body.number });
      updateXmltv();
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/channel', async (req, res) => {
    try {
      const ctx = await serverContext();
      await m3uService.clearCache();
      cleanUpChannel(req.body);
      await channelDB.saveChannel(req.body as Channel);
      ctx.channelCache.clear();
      res.send({ number: req.body.number });
      updateXmltv();
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.delete('/api/channel', async (req, res) => {
    try {
      const ctx = await serverContext();
      await m3uService.clearCache();
      await channelDB.deleteChannel(req.body.number);
      ctx.channelCache.clear();
      res.send({ number: req.body.number });
      updateXmltv();
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.post('/api/upload/image', async (req, res) => {
    try {
      if (!req.files) {
        res.send({
          status: false,
          message: 'No file uploaded',
        });
      } else {
        const logo = req.files.image as fileUpload.UploadedFile;
        logo.mv(
          path.join(serverOptions().database, '/images/uploads/', logo.name),
        );

        res.send({
          status: true,
          message: 'File is uploaded',
          data: {
            name: logo.name,
            mimetype: logo.mimetype,
            size: logo.size,
            fileUrl: `${req.protocol}://${req.get('host')}/images/uploads/${
              logo.name
            }`,
          },
        });
      }
    } catch (err) {
      res.status(500).send(err);
    }
  });

  // Filler
  router.get('/api/fillers', async (_req, res) => {
    try {
      let fillers = await fillerDB.getAllFillersInfo();
      res.send(fillers);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.get('/api/filler/:id', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      let filler = await fillerDB.getFiller(id);
      if (filler == null) {
        res.status(404).send('Filler not found');
      }
      res.send(filler);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.post('/api/filler/:id', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      await fillerDB.saveFiller(id, req.body);
      res.status(204).send({});
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/filler', async (req, res) => {
    try {
      let uuid = await fillerDB.createFiller(req.body);
      res.status(201).send({ id: uuid });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.delete('/api/filler/:id', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      await fillerDB.deleteFiller(id);
      res.status(204).send({});
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.get('/api/filler/:id/channels', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      let channels = await fillerDB.getFillerChannels(id);
      if (channels == null) {
        res.status(404).send('Filler not found');
      }
      res.send(channels);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  // Custom Shows
  router.get('/api/shows', async (_req, res) => {
    try {
      let fillers = await customShowDB.getAllShowsInfo();
      res.send(fillers);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.get('/api/show/:id', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      let filler = await customShowDB.getShow(id);
      if (filler == null) {
        res.status(404).send('Custom show not found');
      }
      res.send(filler);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.post('/api/show/:id', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      await customShowDB.saveShow(id, req.body);
      res.status(204).send({});
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/show', async (req, res) => {
    try {
      let uuid = await customShowDB.createShow(req.body);
      res.status(201).send({ id: uuid });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.delete('/api/show/:id', async (req, res) => {
    try {
      let id = req.params.id;
      if (isUndefined(id)) {
        res.status(400).send('Missing id');
      }
      await customShowDB.deleteShow(id);
      res.status(204).send({});
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  // FFMPEG SETTINGS
  router.get('/api/ffmpeg-settings', (_req, res) => {
    try {
      let ffmpeg = db['ffmpeg-settings'].find()[0];
      res.send(ffmpeg);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/ffmpeg-settings', (req, res) => {
    try {
      db['ffmpeg-settings'].update({ _id: req.body._id }, req.body);
      let ffmpeg = db['ffmpeg-settings'].find()[0];
      let err = fixupFFMPEGSettings(ffmpeg);
      if (typeof err !== 'undefined') {
        res.status(400).send(err);
      }
      eventService.push('settings-update', {
        message: 'FFMPEG configuration updated.',
        module: 'ffmpeg',
        detail: {
          action: 'update',
        },
        level: 'info',
      });
      res.send(ffmpeg);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error updating FFMPEG configuration.',
        module: 'ffmpeg',
        detail: {
          action: 'update',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });
  router.post('/api/ffmpeg-settings', (req, res) => {
    // RESET
    try {
      let ffmpeg = databaseMigration.ffmpeg();
      ffmpeg.ffmpegPath = req.body.ffmpegPath;
      db['ffmpeg-settings'].update({ _id: req.body._id }, ffmpeg);
      ffmpeg = db['ffmpeg-settings'].find()[0];
      eventService.push('settings-update', {
        message: 'FFMPEG configuration reset.',
        module: 'ffmpeg',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });
      res.send(ffmpeg);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error reseting FFMPEG configuration.',
        module: 'ffmpeg',
        detail: {
          action: 'reset',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });

  function fixupFFMPEGSettings(ffmpeg): string | undefined {
    if (isUndefined(ffmpeg.maxFPS)) {
      ffmpeg.maxFPS = 60;
    } else if (isNaN(ffmpeg.maxFPS)) {
      return 'maxFPS should be a number';
    }
    return void 0;
  }

  // PLEX SETTINGS
  router.get('/api/plex-settings', (_req, res) => {
    try {
      let plex = db['plex-settings'].find()[0];
      res.send(plex);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/plex-settings', (req, res) => {
    try {
      db['plex-settings'].update({ _id: req.body._id }, req.body);
      let plex = db['plex-settings'].find()[0];
      res.send(plex);
      eventService.push('settings-update', {
        message: 'Plex configuration updated.',
        module: 'plex',
        detail: {
          action: 'update',
        },
        level: 'info',
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error updating Plex configuration',
        module: 'plex',
        detail: {
          action: 'update',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });
  router.post('/api/plex-settings', (req, res) => {
    // RESET
    try {
      db['plex-settings'].update(
        { _id: req.body._id },
        {
          streamPath: 'plex',
          debugLogging: true,
          directStreamBitrate: '20000',
          transcodeBitrate: '2000',
          mediaBufferSize: 1000,
          transcodeMediaBufferSize: 20000,
          maxPlayableResolution: '1920x1080',
          maxTranscodeResolution: '1920x1080',
          videoCodecs: 'h264,hevc,mpeg2video,av1',
          audioCodecs: 'ac3',
          maxAudioChannels: '2',
          audioBoost: '100',
          enableSubtitles: false,
          subtitleSize: '100',
          updatePlayStatus: false,
          streamProtocol: 'http',
          forceDirectPlay: false,
          pathReplace: '',
          pathReplaceWith: '',
        },
      );
      let plex = db['plex-settings'].find()[0];
      res.send(plex);
      eventService.push('settings-update', {
        message: 'Plex configuration reset.',
        module: 'plex',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');

      eventService.push('settings-update', {
        message: 'Error reseting Plex configuration',
        module: 'plex',
        detail: {
          action: 'reset',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });

  router.get('/api/xmltv-last-refresh', (_req, res) => {
    try {
      res.send(JSON.stringify({ value: xmltvInterval.lastUpdated.valueOf() }));
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  // XMLTV SETTINGS
  router.get('/api/xmltv-settings', async (_req, res) => {
    try {
      const db = await getDB();
      res.json(db.xmlTvSettings());
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/xmltv-settings', async (req, res) => {
    try {
      let xmltv = db['xmltv-settings'].find()[0];
      db['xmltv-settings'].update(
        { _id: req.body._id },
        {
          _id: req.body._id,
          cache: req.body.cache,
          refresh: req.body.refresh,
          enableImageCache: req.body.enableImageCache === true,
          file: xmltv.file,
        },
      );
      xmltv = db['xmltv-settings'].find()[0];
      res.send(xmltv);
      eventService.push('settings-update', {
        message: 'xmltv settings updated.',
        module: 'xmltv',
        detail: {
          action: 'update',
        },
        level: 'info',
      });
      updateXmltv();
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');

      eventService.push('settings-update', {
        message: 'Error updating xmltv configuration',
        module: 'xmltv',
        detail: {
          action: 'update',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });
  router.post('/api/xmltv-settings', (req, res) => {
    try {
      db['xmltv-settings'].update(
        { _id: req.body._id },
        {
          _id: req.body._id,
          cache: 12,
          refresh: 4,
          file: serverOptions().database + '/xmltv.xml',
        },
      );
      var xmltv = db['xmltv-settings'].find()[0];
      res.send(xmltv);
      eventService.push('settings-update', {
        message: 'xmltv settings reset.',
        module: 'xmltv',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });

      updateXmltv();
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error reseting xmltv configuration',
        module: 'xmltv',
        detail: {
          action: 'reset',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });

  router.get('/api/guide/status', async (_req, res) => {
    try {
      let s = await guideService.getStatus();
      res.send(s);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.get('/api/guide/debug', async (_req, res) => {
    try {
      let s = await guideService.get();
      res.send(s);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.get('/api/guide/channels/:number', async (req, res) => {
    try {
      // TODO determine if these params are numbers or strings
      let dateFrom = new Date(req.query.dateFrom as string);
      let dateTo = new Date(req.query.dateTo as string);
      let lineup = await guideService.getChannelLineup(
        parseInt(req.params.number),
        dateFrom,
        dateTo,
      );
      if (lineup == null) {
        logger.info(
          `GET /api/guide/channels/${req.params.number} : 404 Not Found`,
        );
        res.status(404).send('Channel not found in TV guide');
      } else {
        res.send(lineup);
      }
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  //HDHR SETTINGS
  router.get('/api/hdhr-settings', (_req, res) => {
    try {
      let hdhr = db['hdhr-settings'].find()[0];
      res.send(hdhr);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });
  router.put('/api/hdhr-settings', (req, res) => {
    try {
      db['hdhr-settings'].update({ _id: req.body._id }, req.body);
      let hdhr = db['hdhr-settings'].find()[0];
      res.send(hdhr);
      eventService.push('settings-update', {
        message: 'HDHR configuration updated.',
        module: 'hdhr',
        detail: {
          action: 'update',
        },
        level: 'info',
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error updating HDHR configuration',
        module: 'hdhr',
        detail: {
          action: 'action',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });
  router.post('/api/hdhr-settings', (req, res) => {
    try {
      db['hdhr-settings'].update(
        { _id: req.body._id },
        {
          _id: req.body._id,
          tunerCount: 1,
          autoDiscovery: true,
        },
      );
      var hdhr = db['hdhr-settings'].find()[0];
      res.send(hdhr);
      eventService.push('settings-update', {
        message: 'HDHR configuration reset.',
        module: 'hdhr',
        detail: {
          action: 'reset',
        },
        level: 'warning',
      });
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
      eventService.push('settings-update', {
        message: 'Error reseting HDHR configuration',
        module: 'hdhr',
        detail: {
          action: 'reset',
          error: safeString(err, 'message'),
        },
        level: 'danger',
      });
    }
  });

  // XMLTV.XML Download
  router.get('/api/xmltv.xml', async (req, res) => {
    try {
      const host = `${req.protocol}://${req.get('host')}`;

      res.set('Cache-Control', 'no-store');
      res.type('application/xml');

      let xmltvSettings = db['xmltv-settings'].find()[0];
      const fileContent = await fs.readFileSync(xmltvSettings.file, 'utf8');
      const fileFinal = fileContent.replace(/\{\{host\}\}/g, host);
      res.send(fileFinal);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  //tool services
  router.post('/api/channel-tools/time-slots', async (req, res) => {
    try {
      let toolRes = await timeSlotsService(
        req.body.programs,
        req.body.schedule,
      );
      if (typeof toolRes.userError !== 'undefined') {
        logger.error('time slots error: ' + toolRes.userError);
        res.status(400).send(toolRes.userError);
      }
      await streamToolResult(toolRes, res);
    } catch (err) {
      logger.error(err);
      res.status(500).send('Internal error');
    }
  });

  router.post('/api/channel-tools/random-slots', async (req, res) => {
    try {
      let toolRes = await randomSlotsService(
        req.body.programs,
        req.body.schedule,
      );
      if (typeof toolRes.userError !== 'undefined') {
        logger.error('random slots error: ' + toolRes.userError);
        res.status(400).send(toolRes.userError);
      }
      await streamToolResult(toolRes, res);
    } catch (err) {
      logger.error('Error', err);
      res.status(500).send('Internal error');
    }
  });

  // CHANNELS.M3U Download
  router.get('/api/channels.m3u', async (req, res) => {
    try {
      res.type('text');

      const host = `${req.protocol}://${req.get('host')}`;
      const data = await m3uService.getChannelList(host);

      res.send(data);
    } catch (err) {
      logger.error(err);
      res.status(500).send('error');
    }
  });

  router.get('/api/plex', async (req, res) => {
    const db = await getDB();
    const servers = db.plexServers();
    const server = find(servers, { name: req.query['name'] as string });
    if (isUndefined(server)) {
      return res
        .status(404)
        .json({ error: 'No server found with name: ' + req.query.name });
    }

    const plex = new Plex(server);
    return res.json(await plex.Get(req.query['path']));
  });

  function updateXmltv() {
    xmltvInterval.updateXML();
    xmltvInterval.restartInterval();
  }

  function cleanUpProgram(program) {
    delete program.start;
    delete program.stop;
    delete program.streams;
    delete program.durationStr;
    delete program.commercials;
    if (isUndefined(program.duration) || program.duration <= 0) {
      logger.error(
        `Input contained a program with invalid duration: ${program.duration}. This program has been deleted`,
      );
      return [];
    }
    if (!Number.isInteger(program.duration)) {
      logger.error(
        `Input contained a program with invalid duration: ${program.duration}. Duration got fixed to be integer.`,
      );
      program.duration = Math.ceil(program.duration);
    }
    return [program];
  }

  function cleanUpChannel(channel) {
    if (isUndefined(channel.groupTitle) || channel.groupTitle === '') {
      channel.groupTitle = 'dizqueTV';
    }
    channel.programs = channel.programs.flatMap(cleanUpProgram);
    delete channel.fillerContent;
    delete channel.filler;
    channel.fallback = channel.fallback.flatMap(cleanUpProgram);
    channel.duration = 0;
    for (let i = 0; i < channel.programs.length; i++) {
      channel.duration += channel.programs[i].duration;
    }
  }

  async function streamToolResult(toolRes, res) {
    let programs = toolRes.programs;
    delete toolRes.programs;
    let s = JSON.stringify(toolRes);
    s = s.slice(0, -1);
    logger.info(JSON.stringify(toolRes));

    res.writeHead(200, {
      'Content-Type': 'application/json',
    });

    let transformStream = JSONStream.stringify(s + ',"programs":[', ',', ']}');
    transformStream.pipe(res);

    for (let i = 0; i < programs.length; i++) {
      transformStream.write(programs[i]);
      await throttle();
    }
    transformStream.end();
  }

  return router;
}
