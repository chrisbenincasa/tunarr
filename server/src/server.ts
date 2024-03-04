import cors from '@fastify/cors';
import middie from '@fastify/middie';
import fpStatic from '@fastify/static';
import fastify from 'fastify';
import fp from 'fastify-plugin';
// import fastifyPrintRoutes from 'fastify-print-routes';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import { RequestContext } from '@mikro-orm/core';
import fastifyPrintRoutes from 'fastify-print-routes';
import {
  ZodTypeProvider,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import fs from 'fs';
import morgan from 'morgan';
import { onShutdown } from 'node-graceful-shutdown';
import path, { dirname } from 'path';
import serveStatic from 'serve-static';
import { miscRouter } from './api.js';
import { ffmpegSettingsRouter } from './api/ffmpegSettingsApi.js';
import { guideRouter } from './api/guideApi.js';
import { hdhrSettingsRouter } from './api/hdhrSettingsApi.js';
import { plexServersRouter } from './api/plexServersApi.js';
import { plexSettingsRouter } from './api/plexSettingsApi.js';
import { schedulerRouter } from './api/schedulerApi.js';
import { debugApi } from './api/v2/debugApi.js';
import registerV2Routes from './api/v2/index.js';
import { xmlTvSettingsRouter } from './api/xmltvSettingsApi.js';
import { EntityManager, initOrm } from './dao/dataSource.js';
import { migrateFromLegacyDb } from './dao/legacyDbMigration.js';
import { getSettingsRawDb } from './dao/settings.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { serverContext } from './serverContext.js';
import { scheduleJobs, scheduledJobsById } from './services/scheduler.js';
import { runFixers } from './tasks/fixers/index.js';
import { UpdateXmlTvTask } from './tasks/updateXmlTvTask.js';
import { ServerOptions } from './types.js';
import { filename, wait } from './util.js';
import { videoRouter } from './video.js';

const logger = createLogger(import.meta);
const currentDirectory = dirname(filename(import.meta.url));

function initDbDirectories() {
  const opts = serverOptions();
  const hasLegacyDb = !fs.existsSync(opts.database);
  if (hasLegacyDb) {
    if (fs.existsSync(path.join('.', '.pseudotv'))) {
      throw Error(
        opts.database +
          ' folder not found but ./.pseudotv has been found. Please rename this folder or create an empty ' +
          opts.database +
          ' folder so that the program is not confused about.',
      );
    }
    fs.mkdirSync(opts.database);
  }

  ['channel-lineups', 'images', 'cache'].forEach((filePath) => {
    const pathToCheck = path.join(opts.database, filePath);
    if (!fs.existsSync(pathToCheck)) {
      logger.debug(`Creating path at ${pathToCheck}`);
      fs.mkdirSync(pathToCheck);
    }
  });

  if (!fs.existsSync(path.join(opts.database, 'cache', 'images'))) {
    fs.mkdirSync(path.join(opts.database, 'cache', 'images'));
  }

  if (!fs.existsSync('streams')) {
    fs.mkdirSync('streams');
  }

  return hasLegacyDb;
}

export async function initServer(opts: ServerOptions) {
  onShutdown('log', [], async () => {
    const ctx = await serverContext();
    const t = new Date().getTime();
    ctx.eventService.push({
      type: 'lifecycle',
      message: `Initiated Server Shutdown`,
      detail: {
        time: t,
      },
      level: 'warning',
    });

    logger.info('Received exit signal, attempting graceful shutdonw...');
    await wait(2000);
  });

  onShutdown('xmltv-writer', [], async () => {
    const ctx = await serverContext();
    await ctx.xmltv.shutdown();
  });

  const hadLegacyDb = initDbDirectories();

  const orm = await initOrm();

  const ctx = await serverContext();

  if (hadLegacyDb && ctx.settings.needsLegacyMigration()) {
    logger.info('Migrating from legacy database folder...');
    await migrateFromLegacyDb(await getSettingsRawDb());
  }

  scheduleJobs(ctx);
  await runFixers();

  const updateXMLPromise = scheduledJobsById[UpdateXmlTvTask.ID]!.runNow();

  const app = fastify({ logger: false, bodyLimit: 50 * 1024 * 1024 })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>();

  await app
    .register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Tunarr API',
          description: 'test',
          version: '1.0.0',
        },
        servers: [],
      },
      transform: jsonSchemaTransform,
    })
    .register(fastifySwaggerUi, {
      routePrefix: '/docs',
    })
    .register(middie)
    .register(cors, {
      origin: '*', // Testing
    })
    .addHook('onRequest', (_req, _rep, done) =>
      RequestContext.create(orm.em, done),
    )
    .addHook('onClose', async () => await orm.close())
    .register(
      fp((f, _, done) => {
        f.decorateRequest('serverCtx', null);
        f.addHook('onRequest', async (req) => {
          req.serverCtx = await serverContext();
          req.entityManager =
            RequestContext.getEntityManager()! as EntityManager;
        });
        done();
      }),
    );

  if (serverOptions().printRoutes) {
    await app.register(fastifyPrintRoutes);
  }

  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
      skip: (req) => {
        return req.url ? req.url.startsWith('/streams') : false;
      },
    }),
  );

  ctx.eventService.setup(app);

  app
    // .use(serveStatic(fileURLToPath(new URL('../web/public', import.meta.url))))
    .use(
      '/images',
      serveStatic(path.join(currentDirectory, 'resources', 'images')),
    )
    .use(
      '/favicon.svg',
      serveStatic(
        path.join(currentDirectory, 'resources', 'images', 'favicon.svg'),
      ),
    );
  // .use('/custom.css', serveStatic(path.join(opts.database, 'custom.css')));

  // API Routers
  await app
    .register(async (f) => {
      await f.register(fpStatic, {
        root: path.join(opts.database, 'cache', 'images'),
      });
      // f.addHook('onRequest', async (req, res) => ctx.cacheImageService.routerInterceptor(req, res));
      f.get<{ Params: { hash: string } }>(
        '/cache/images/:hash',
        {
          // Workaround for https://github.com/fastify/fastify/issues/4859
          // eslint-disable-next-line @typescript-eslint/no-misused-promises
          onRequest: (req, res) => {
            return ctx.cacheImageService.routerInterceptor(req, res);
          },
        },
        async (req, res) => {
          return res.sendFile(req.params.hash);
        },
      );
    })
    .register(plexServersRouter)
    .register(ffmpegSettingsRouter)
    .register(plexSettingsRouter)
    .register(xmlTvSettingsRouter)
    .register(hdhrSettingsRouter)
    // .register(channelToolRouter)
    .register(guideRouter)
    .register(miscRouter)
    .register(schedulerRouter)
    .register(debugApi)
    .register(registerV2Routes, { prefix: '/api/v2' })
    .register(ctx.cacheImageService.apiRouters(), {
      prefix: '/api/cache/images',
    })
    .register(videoRouter)
    .register(ctx.hdhrService.createRouter());

  await updateXMLPromise;

  app.listen(
    {
      port: opts.port,
    },
    () => {
      logger.info(`HTTP server running on port: http://*:${opts.port}`);
      const hdhrSettings = ctx.settings.hdhrSettings();
      if (hdhrSettings.autoDiscoveryEnabled) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any
        (ctx.hdhrService.ssdp as any).start();
      }

      ctx.eventService.push({
        type: 'lifecycle',
        message: `Server Started`,
        detail: {
          time: new Date().getTime(),
        },
        level: 'success',
      });
    },
  );

  return app;
}
