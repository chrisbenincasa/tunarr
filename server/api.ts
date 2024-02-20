import fileUpload from 'express-fileupload';
import { FastifyPluginCallback } from 'fastify';
import { promises as fsPromises } from 'fs';
import { isNil } from 'lodash-es';
import path from 'path';
import constants from './constants.js';
import { PlexServerSettings } from './dao/entities/PlexServerSettings.js';
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

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error('%s %O', req.routeOptions.url, error);
    done();
  });

  fastify.get('/api/version', async (req, res) => {
    try {
      const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();
      const v = await new FFMPEGInfo(ffmpegSettings).getVersion();
      return res.send({
        dizquetv: constants.VERSION_NAME,
        ffmpeg: v,
        nodejs: process.version.replace('v', ''),
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

      const xmltvSettings = req.serverCtx.settings.xmlTvSettings();
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
      logger.error('%O', err);
      return res.status(500).send('error');
    }
  });

  // Force an XMLTV refresh
  fastify.post('/api/xmltv/refresh', async (_, res) => {
    await scheduledJobsById['update-xmltv']?.runNow();
    return res.status(200);
  });

  // CHANNELS.M3U Download
  fastify.get('/api/channels.m3u', async (req, res) => {
    try {
      const host = `${req.protocol}://${req.hostname}`;
      const data = await req.serverCtx.m3uService.getChannelList(host);

      return res.type('text').send(data);
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  fastify.get<{ Querystring: { name: string; path: string } }>(
    '/api/plex',
    async (req, res) => {
      const server = await req.entityManager
        .repo(PlexServerSettings)
        .findOne({ name: req.query.name });
      if (isNil(server)) {
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
