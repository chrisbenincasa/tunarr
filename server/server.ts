import cors from '@fastify/cors';
import middie from '@fastify/middie';
import fpStatic from '@fastify/static';
import fastify from 'fastify';
import fp from 'fastify-plugin';
// import fastifyPrintRoutes from 'fastify-print-routes';
import { RequestContext } from '@mikro-orm/core';
import {
  ZodTypeProvider,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import fs from 'fs';
import morgan from 'morgan';
import { onShutdown } from 'node-graceful-shutdown';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'path';
import serveStatic from 'serve-static';
import { miscRouter } from './api.js';
import { channelToolRouter } from './api/channelToolsApi.js';
import { channelsRouter } from './api/channelsApi.js';
import { customShowRouter } from './api/customShowApi.js';
import { debugRouter } from './api/debugApi.js';
import { ffmpegSettingsRouter } from './api/ffmpegSettingsApi.js';
import { fillerRouter } from './api/filllerApi.js';
import { guideRouter } from './api/guideApi.js';
import { hdhrSettingsRouter } from './api/hdhrSettingsApi.js';
import { plexServersRouter } from './api/plexServersApi.js';
import { plexSettingsRouter } from './api/plexSettingsApi.js';
import { schedulerRouter } from './api/schedulerApi.js';
import registerV2Routes from './api/v2/index.js';
import { xmlTvSettingsRouter } from './api/xmltvSettingsApi.js';
import constants from './constants.js';
import { EntityManager, initOrm } from './dao/dataSource.js';
import { migrateFromLegacyDb } from './dao/legacyDbMigration.js';
import { getSettingsRawDb } from './dao/settings.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { serverContext } from './serverContext.js';
import { scheduleJobs, scheduledJobsById } from './services/scheduler.js';
import { UpdateXmlTvTask } from './tasks/updateXmlTvTask.js';
import { ServerOptions } from './types.js';
import { videoRouter } from './video.js';
import { wait } from './util.js';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';

const logger = createLogger(import.meta);

// Temporary
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log(
  `         \\
   dizqueTV ${constants.VERSION_NAME}
.------------.
|:::///### o |
|:::///###   |
':::///### o |
'------------'
`,
);

const NODE = parseInt(process.version.match(/^[^0-9]*(\d+)\..*$/)![1]);

if (NODE < 12) {
  logger.error(
    `WARNING: Your nodejs version ${process.version} is lower than supported. dizqueTV has been tested best on nodejs 12.16.`,
  );
}

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
  return hasLegacyDb;
}

export async function initServer(opts: ServerOptions) {
  const hadLegacyDb = initDbDirectories();

  const orm = await initOrm();

  const ctx = await serverContext();

  if (hadLegacyDb && ctx.settings.needsLegacyMigration()) {
    logger.info('Migrating from legacy database folder...');
    await migrateFromLegacyDb(await getSettingsRawDb());
  }

  scheduleJobs(ctx);

  const updateXMLPromise = scheduledJobsById[UpdateXmlTvTask.ID]?.runNow();

  const app = fastify({ logger: false, bodyLimit: 50 * 1024 });
  await app
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>()
    .register(fastifySwagger, {
      openapi: {
        info: {
          title: 'DizqueTV API',
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
    // .register(fastifyPrintRoutes)
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

  await app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
    }),
  );

  ctx.eventService.setup(app);

  await app
    .use('/images', serveStatic(path.join(opts.database, 'images')))
    .use(serveStatic(fileURLToPath(new URL('../web/public', import.meta.url))))
    .use('/images', serveStatic(path.join(opts.database, 'images')))
    .use(
      '/favicon.svg',
      serveStatic(path.join(__dirname, 'resources', 'favicon.svg')),
    )
    .use('/custom.css', serveStatic(path.join(opts.database, 'custom.css')));

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
    .register(channelsRouter)
    .register(fillerRouter)
    .register(customShowRouter)
    .register(ffmpegSettingsRouter)
    .register(plexSettingsRouter)
    .register(xmlTvSettingsRouter)
    .register(hdhrSettingsRouter)
    .register(channelToolRouter)
    .register(guideRouter)
    .register(miscRouter)
    .register(schedulerRouter)
    .register(debugRouter)
    .register(registerV2Routes, { prefix: '/api/v2' });

  await app
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

      ctx.eventService.push('lifecycle', {
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

onShutdown('log', [], async () => {
  const ctx = await serverContext();
  const t = new Date().getTime();
  ctx.eventService.push('lifecycle', {
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
