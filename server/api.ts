import fileUpload from 'express-fileupload';
import { FastifyPluginCallback } from 'fastify';
import { promises as fsPromises } from 'fs';
import { find, isNil, isUndefined } from 'lodash-es';
import path from 'path';
import constants from './constants.js';
import { getDB } from './dao/db.js';
import { FFMPEGInfo } from './ffmpegInfo.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { Plex } from './plex.js';
import { scheduledJobsById } from './services/scheduler.js';

const logger = createLogger(import.meta);

declare module 'fastify' {
  interface FastifyRequest {
    files: fileUpload.FileArray | null | undefined;
  }
}

export const miscRouter: FastifyPluginCallback = (fastify, _opts, done) => {
  fastify.use(
    fileUpload({
      createParentPath: true,
    }),
  );

  fastify.get('/api/version', async (req, res) => {
    try {
      const ffmpegSettings = req.serverCtx.dbAccess.ffmpegSettings();
      const v = await new FFMPEGInfo(ffmpegSettings).getVersion();
      return res.send({
        dizquetv: constants.VERSION_NAME,
        ffmpeg: v,
        nodejs: process.version,
      });
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.post('/api/upload/image', async (req, res) => {
    try {
      if (isNil(req.files)) {
        return res.send({
          status: false,
          message: 'No file uploaded',
        });
      }

      const logo = req.files.image as fileUpload.UploadedFile;
      await logo.mv(
        path.join(serverOptions().database, '/images/uploads/', logo.name),
      );

      return res.send({
        status: true,
        message: 'File is uploaded',
        data: {
          name: logo.name,
          mimetype: logo.mimetype,
          size: logo.size,
          fileUrl: `${req.protocol}://${req.hostname}/images/uploads/${logo.name}`,
        },
      });
    } catch (err) {
      return res.status(500).send(err);
    }
  });

  fastify.get('/api/xmltv-last-refresh', (_req, res) => {
    try {
      return res.send({
        value: scheduledJobsById['update-xmltv']?.lastExecution?.valueOf(),
      });
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  // XMLTV.XML Download
  fastify.get('/api/xmltv.xml', async (req, res) => {
    try {
      const host = `${req.protocol}://${req.hostname}`;

      const xmltvSettings = req.serverCtx.dbAccess.xmlTvSettings();
      const fileContent = await fsPromises.readFile(
        xmltvSettings.outputPath,
        'utf8',
      );
      const fileFinal = fileContent.replace(/\{\{host\}\}/g, host);
      return res
        .header('Cache-Control', 'no-store')
        .header('Content-Type', 'application/xml')
        .send(fileFinal);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  // CHANNELS.M3U Download
  fastify.get('/api/channels.m3u', async (req, res) => {
    try {
      await res.type('text');

      const host = `${req.protocol}://${req.hostname}`;
      const data = await req.serverCtx.m3uService.getChannelList(host);

      return res.send(data);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.get<{ Querystring: { name: string; path: string } }>(
    '/api/plex',
    async (req, res) => {
      const db = await getDB();
      const servers = db.plexServers().getAll();
      const server = find(servers, { name: req.query.name });
      if (isUndefined(server)) {
        return res
          .status(404)
          .send({ error: 'No server found with name: ' + req.query.name });
      }

      const plex = new Plex(server);
      return res.send(await plex.Get(req.query.path));
    },
  );

  done();
};
