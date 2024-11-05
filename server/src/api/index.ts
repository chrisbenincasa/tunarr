import { VersionApiResponseSchema } from '@tunarr/types/api';
import { fileTypeFromStream } from 'file-type';
import { createReadStream, promises as fsPromises } from 'fs';
import { isEmpty, isError, isNil } from 'lodash-es';
import path from 'path';
import { z } from 'zod';
import { MediaSourceType } from '../dao/direct/schema/MediaSource.ts';
import { MediaSourceApiFactory } from '../external/MediaSourceApiFactory.js';
import { FFMPEGInfo } from '../ffmpeg/ffmpegInfo.js';
import { serverOptions } from '../globals.js';
import { GlobalScheduler } from '../services/scheduler.js';
import { UpdateXmlTvTask } from '../tasks/UpdateXmlTvTask.js';
import { RouterPluginAsyncCallback } from '../types/serverType.js';
import { fileExists } from '../util/fsUtil.js';
import {
  isEdgeBuild,
  isNonEmptyString,
  isProduction,
  run,
  tunarrBuild,
} from '../util/index.js';
import { LoggerFactory } from '../util/logging/LoggerFactory.js';
import { getTunarrVersion } from '../util/version.js';
import { channelsApi } from './channelsApi.js';
import { customShowsApiV2 } from './customShowsApi.js';
import { debugApi } from './debugApi.js';
import { ffmpegSettingsRouter } from './ffmpegSettingsApi.js';
import { fillerListsApi } from './fillerListsApi.js';
import { guideRouter } from './guideApi.js';
import { hdhrSettingsRouter } from './hdhrSettingsApi.js';
import { jellyfinApiRouter } from './jellyfinApi.js';
import { mediaSourceRouter } from './mediaSourceApi.js';
import { metadataApiRouter } from './metadataApi.js';
import { plexSettingsRouter } from './plexSettingsApi.js';
import { programmingApi } from './programmingApi.js';
import { sessionApiRouter } from './sessionApi.js';
import { systemApiRouter } from './systemApi.js';
import { tasksApiRouter } from './tasksApi.js';
import { xmlTvSettingsRouter } from './xmltvSettingsApi.js';

export const apiRouter: RouterPluginAsyncCallback = async (fastify) => {
  const logger = LoggerFactory.child({ caller: import.meta, className: 'Api' });

  fastify.addContentTypeParser(/^image\/.*/, function (_, payload, done) {
    done(null, payload);
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error({ url: req.routeOptions.config.url, error });
    done();
  });

  await fastify
    .register(tasksApiRouter)
    .register(channelsApi)
    .register(customShowsApiV2)
    .register(fillerListsApi)
    .register(programmingApi)
    .register(debugApi)
    .register(metadataApiRouter)
    .register(mediaSourceRouter)
    .register(ffmpegSettingsRouter)
    .register(plexSettingsRouter)
    .register(xmlTvSettingsRouter)
    .register(hdhrSettingsRouter)
    .register(systemApiRouter)
    .register(guideRouter)
    .register(jellyfinApiRouter)
    .register(sessionApiRouter);

  fastify.get(
    '/version',
    {
      schema: {
        response: {
          200: VersionApiResponseSchema,
          500: z.void(),
        },
      },
    },
    async (req, res) => {
      try {
        const ffmpegSettings = req.serverCtx.settings.ffmpegSettings();
        const v = await new FFMPEGInfo(ffmpegSettings).getVersion();
        let tunarrVersion: string = getTunarrVersion();
        if (!isProduction) {
          tunarrVersion += `-dev`;
        } else if (isEdgeBuild && isNonEmptyString(tunarrBuild)) {
          tunarrVersion += `-${tunarrBuild}`;
        }
        return res.send({
          tunarr: tunarrVersion,
          ffmpeg: v.versionString,
          nodejs: process.version.replace('v', ''),
        });
      } catch (err) {
        logger.error(err);
        return res.status(500).send();
      }
    },
  );

  fastify.get('/ffmpeg-info', async (req, res) => {
    const info = new FFMPEGInfo(req.serverCtx.settings.ffmpegSettings());
    const [audioEncoders, videoEncoders] = await Promise.all([
      run(async () => {
        const res = await info.getAvailableAudioEncoders();
        return isError(res) ? [] : res;
      }),
      run(async () => {
        const res = await info.getAvailableVideoEncoders();
        return isError(res) ? [] : res;
      }),
    ]);
    const hwAccels = await info.getHwAccels();
    return res.send({
      audioEncoders,
      videoEncoders,
      hardwareAccelerationTypes: hwAccels,
    });
  });

  fastify.post('/upload/image', async (req, res) => {
    try {
      const allSavedFiles = await req.saveRequestFiles();

      if (isEmpty(allSavedFiles)) {
        return res.status(400).send();
      }

      // We disregard any other files that were part of the upload
      const data = allSavedFiles[0];

      const fileType = await fileTypeFromStream(
        createReadStream(data.filepath),
      );

      if (!fileType?.mime.startsWith('image/')) {
        return res.status(400).send();
      }

      const baseDir = path.join(
        serverOptions().databaseDirectory,
        'images',
        'uploads',
      );

      if (!(await fileExists(baseDir))) {
        await fsPromises.mkdir(baseDir, { recursive: true });
      }

      // await pipeline(
      //   createReadStream(data.filepath),
      //   createWriteStream(path.join(baseDir, data.filename)),
      // );

      await fsPromises.rename(data.filepath, path.join(baseDir, data.filename));

      return res.send({
        status: true,
        message: 'File is uploaded',
        data: {
          name: data.filename,
          size: data.fields.size,
          fileUrl: `${req.protocol}://${req.host}/images/uploads/${data.filename}`,
        },
      });
    } catch (err) {
      return res.status(500).send(err);
    }
  });

  fastify.get('/xmltv-last-refresh', (_req, res) => {
    try {
      return res.send({
        value: GlobalScheduler.getScheduledJob(
          UpdateXmlTvTask.ID,
        ).lastExecution?.valueOf(),
      });
    } catch (err) {
      logger.error(err);
      return res.status(500).send('error');
    }
  });

  // XMLTV.XML Download
  fastify.route({
    url: '/xmltv.xml',
    method: ['HEAD', 'GET'],
    handler: async (req, res) => {
      try {
        const host = `${req.protocol}://${req.host}`;

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
    },
  });

  // Force an XMLTV refresh
  fastify.post('/xmltv/refresh', async (_, res) => {
    await GlobalScheduler.getScheduledJob(UpdateXmlTvTask.ID).runNow(false);
    return res.status(200);
  });

  // CHANNELS.M3U Download
  fastify.route({
    url: '/channels.m3u',
    method: ['HEAD', 'GET'],
    handler: async (req, res) => {
      try {
        const host = `${req.protocol}://${req.host}`;
        const data = await req.serverCtx.m3uService.getChannelsM3U(host);

        return res.type('text').send(data);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  });

  fastify.delete('/channels.m3u', async (req, res) => {
    await req.serverCtx.m3uService.regenerateCache();
    return res.send(204);
  });

  fastify.get(
    '/plex',
    {
      schema: {
        querystring: z.object({ id: z.string(), path: z.string() }),
      },
    },
    async (req, res) => {
      req.logRequestAtLevel = 'trace';
      const server = await req.serverCtx.mediaSourceDB.findByType(
        MediaSourceType.Plex,
        req.query.id,
      );

      if (isNil(server)) {
        return res
          .status(404)
          .send({ error: 'No server found with id: ' + req.query.id });
      }

      const plex = MediaSourceApiFactory().get(server);
      return res.send(await plex.doGetPath(req.query.path));
    },
  );
};
