import type { FfmpegEncoder } from '@/ffmpeg/ffmpegInfo.js';
import { FfmpegInfo } from '@/ffmpeg/ffmpegInfo.js';
import { globalOptions, serverOptions } from '@/globals.js';
import { GlobalScheduler } from '@/services/Scheduler.js';
import { UpdateXmlTvTask } from '@/tasks/UpdateXmlTvTask.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { fileExists } from '@/util/fsUtil.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import { getTunarrVersion } from '@/util/version.js';
import fpStatic from '@fastify/static';
import { VersionApiResponseSchema } from '@tunarr/types/api';
import { fileTypeFromStream } from 'file-type';
import { isEmpty } from 'lodash-es';
import { createReadStream, promises as fsPromises } from 'node:fs';
import path from 'node:path';
import { z } from 'zod/v4';
import { container } from '../container.ts';
import { TruthyQueryParam } from '../types/schemas.ts';
import { isNonEmptyString, run } from '../util/index.js';
import { channelsApi } from './channelsApi.js';
import { CreditsApiController } from './creditsApi.ts';
import { customShowsApiV2 } from './customShowsApi.js';
import { debugApi } from './debugApi.js';
import { embyApiRouter } from './embyApi.ts';
import { ffmpegSettingsRouter } from './ffmpegSettingsApi.js';
import { fillerListsApi } from './fillerListsApi.js';
import { guideRouter } from './guideApi.js';
import { hdhrSettingsRouter } from './hdhrSettingsApi.js';
import { jellyfinApiRouter } from './jellyfinApi.js';
import { mediaSourceRouter } from './mediaSourceApi.js';
import { metadataApiRouter } from './metadataApi.js';
import { plexApiRouter } from './plexApi.ts';
import { plexSettingsRouter } from './plexSettingsApi.js';
import { programmingApi } from './programmingApi.js';
import { sessionApiRouter } from './sessionApi.js';
import { settingsApi } from './settingsApi.ts';
import { SmartCollectionsApiController } from './smartCollectionsApi.ts';
import { systemApiRouter } from './systemApi.js';
import { tasksApiRouter } from './tasksApi.js';
import { trashApi } from './trashApi.ts';
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
    .register(fpStatic, {
      root: globalOptions().databaseDirectory,
      serve: false,
      decorateReply: true,
    })
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
    .register(plexApiRouter)
    .register(jellyfinApiRouter)
    .register(sessionApiRouter)
    .register(embyApiRouter)
    .register(settingsApi)
    .register(trashApi)
    .register(container.get(SmartCollectionsApiController).mount)
    .register(container.get(CreditsApiController).mount);

  fastify.get(
    '/version',
    {
      schema: {
        tags: ['System'],
        response: {
          200: VersionApiResponseSchema,
          500: z.void(),
        },
      },
    },
    async (_, res) => {
      try {
        const v = await container.get<FfmpegInfo>(FfmpegInfo).getVersion();
        return res.send({
          tunarr: getTunarrVersion(),
          ffmpeg: v.versionString,
          nodejs: process.version.replace('v', ''),
        });
      } catch (err) {
        logger.error(err);
        return res.status(500).send();
      }
    },
  );

  fastify.get(
    '/ffmpeg-info',
    {
      schema: {
        tags: ['System'],
        response: {
          200: z.object({
            audioEncoders: z
              .object({ name: z.string(), ffmpegName: z.string() })
              .array(),
            videoEncoders: z
              .object({ name: z.string(), ffmpegName: z.string() })
              .array(),
            hardwareAccelerationTypes: z.string().array(),
          }),
        },
      },
    },
    async (_, res) => {
      const info = container.get<FfmpegInfo>(FfmpegInfo);
      const [audioEncoders, videoEncoders] = await Promise.all([
        run(async () => {
          const res = await info.getAvailableAudioEncoders();
          return res.getOrElse(() => [] as FfmpegEncoder[]);
        }),
        run(async () => {
          const res = await info.getAvailableVideoEncoders();
          return res.getOrElse(() => [] as FfmpegEncoder[]);
        }),
      ]);
      const hwAccels = await info.getHwAccels();
      return res.send({
        audioEncoders,
        videoEncoders,
        hardwareAccelerationTypes: hwAccels,
      });
    },
  );

  fastify.post(
    '/upload/image',
    {
      schema: {
        consumes: ['multipart/form-data'],
        body: z.any(),
        response: {
          200: z.object({
            name: z.string(),
            fileUrl: z.string(),
          }),
          400: z.void(),
        },
      },
    },
    async (req, res) => {
      const allSavedFiles = await req.saveRequestFiles();

      if (isEmpty(allSavedFiles)) {
        return res.status(400).send();
      }

      // We disregard any other files that were part of the upload
      const data = allSavedFiles[0]!;

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

      await fsPromises.copyFile(
        data.filepath,
        path.join(baseDir, data.filename),
      );

      return res.send({
        name: data.filename,
        fileUrl: `${req.protocol}://${req.host}/images/uploads/${data.filename}`,
      });
    },
  );

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
    schema: {
      tags: ['Streaming'],
    },
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
        logger.error(err);
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
    schema: {
      querystring: z.object({
        forceHttps: TruthyQueryParam.optional(),
        hostOverride: z.string().optional(),
      }),
      tags: ['Streaming'],
    },
    method: ['HEAD', 'GET'],
    handler: async (req, res) => {
      try {
        let protocol = req.protocol;
        if (req.query.forceHttps) {
          protocol = 'https';
        }
        let reqHost = req.host;
        if (isNonEmptyString(req.query.hostOverride)) {
          reqHost = req.query.hostOverride;
        }

        const host = `${protocol}://${reqHost}`;
        const data = await req.serverCtx.m3uService.getChannelsM3U(host);

        return res.type('text').send(data);
      } catch (err) {
        logger.error(err);
        return res.status(500).send('error');
      }
    },
  });

  fastify.delete(
    '/channels.m3u',
    {
      schema: {
        tags: ['Streaming'],
        description: 'Clears the channels m3u cache',
        response: {
          204: z.void(),
        },
      },
    },
    async (req, res) => {
      await req.serverCtx.m3uService.regenerateCache();
      return res.status(204).send();
    },
  );
};
