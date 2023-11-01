import express from 'express';
import fileUpload from 'express-fileupload';
import { promises as fsPromises } from 'fs';
import { find, isUndefined } from 'lodash-es';
import path from 'path';
import constants from './constants.js';
import { getDB } from './dao/db.js';
import { FFMPEGInfo } from './ffmpeg-info.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { Plex } from './plex.js';
import { xmltvInterval } from './xmltv-generator.js';

const logger = createLogger(import.meta);

export const miscRouter = express.Router();

miscRouter.get('/api/version', async (req, res) => {
  try {
    let ffmpegSettings = req.ctx.dbAccess.ffmpegSettings();
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

miscRouter.post('/api/upload/image', async (req, res) => {
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

miscRouter.get('/api/xmltv-last-refresh', (_req, res) => {
  try {
    res.send(JSON.stringify({ value: xmltvInterval.lastRefresh?.valueOf() }));
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

// XMLTV.XML Download
miscRouter.get('/api/xmltv.xml', async (req, res) => {
  try {
    const host = `${req.protocol}://${req.get('host')}`;

    res.set('Cache-Control', 'no-store');
    res.type('application/xml');

    let xmltvSettings = req.ctx.dbAccess.xmlTvSettings();
    const fileContent = await fsPromises.readFile(
      xmltvSettings.outputPath,
      'utf8',
    );
    const fileFinal = fileContent.replace(/\{\{host\}\}/g, host);
    res.send(fileFinal);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

// CHANNELS.M3U Download
miscRouter.get('/api/channels.m3u', async (req, res) => {
  try {
    res.type('text');

    const host = `${req.protocol}://${req.get('host')}`;
    const data = await req.ctx.m3uService.getChannelList(host);

    res.send(data);
  } catch (err) {
    logger.error(err);
    res.status(500).send('error');
  }
});

miscRouter.get('/api/plex', async (req, res) => {
  const db = await getDB();
  const servers = db.plexServers().getAll();
  const server = find(servers, { name: req.query['name'] as string });
  if (isUndefined(server)) {
    return res
      .status(404)
      .json({ error: 'No server found with name: ' + req.query.name });
  }

  const plex = new Plex(server);
  return res.json(await plex.Get(req.query['path']));
});
