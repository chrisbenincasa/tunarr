import cors from '@fastify/cors';
import middie from '@fastify/middie';
import fpStatic from '@fastify/static';
import fastify, { FastifySchema } from 'fastify';
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
import { ffmpegSettingsRouter } from './api/ffmpegSettingsApi.js';
import { guideRouter } from './api/guideApi.js';
import { hdhrSettingsRouter } from './api/hdhrSettingsApi.js';
import { apiRouter } from './api/index.js';
import { plexServersRouter } from './api/plexServersApi.js';
import { plexSettingsRouter } from './api/plexSettingsApi.js';
import { xmlTvSettingsRouter } from './api/xmltvSettingsApi.js';
import { EntityManager, initOrm } from './dao/dataSource.js';
import { migrateFromLegacyDb } from './dao/legacyDbMigration.js';
import { getSettingsRawDb } from './dao/settings.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { ServerRequestContext, serverContext } from './serverContext.js';
import { scheduleJobs, scheduledJobsById } from './services/scheduler.js';
import { runFixers } from './tasks/fixers/index.js';
import { UpdateXmlTvTask } from './tasks/updateXmlTvTask.js';
import { ServerOptions } from './types.js';
import { filename, wait } from './util.js';
import { videoRouter } from './video.js';
import { isUndefined } from 'lodash-es';

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

  if (serverOptions().printRoutes) {
    await app.register(fastifyPrintRoutes);
  }

  await app
    .register(fastifySwagger, {
      openapi: {
        info: {
          title: 'Tunarr',
          description: 'Tunarr API',
          version: '1.0.0',
        },
        servers: [],
        tags: [
          {
            name: 'Channels',
          },
        ],
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
    .addHook('onRequest', (_req, _res, done) => {
      serverContext()
        .then((ctx) => ServerRequestContext.create(ctx, done))
        .catch(done);
    })
    .addHook('onClose', async () => await orm.close())
    .register(
      fp((f, _, done) => {
        f.decorateRequest('serverCtx', null);
        f.addHook('onRequest', (req, _res, done) => {
          req.serverCtx = ServerRequestContext.currentServerContext()!;
          req.entityManager =
            RequestContext.getEntityManager()! as EntityManager;
          done();
        });
        done();
      }),
    );

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

  // API Routers
  await app
    .register((f, _, done) => {
      f.addHook('onRoute', (route) => {
        if (!route.config) {
          route.config = {};
        }
        route.config.swaggerTransform = ({ schema, url }) => {
          const transformedSchema: FastifySchema = isUndefined(schema)
            ? {}
            : { ...schema };
          transformedSchema.hide = true;
          return { schema: transformedSchema, url };
        };
      });
      f.register(fpStatic, {
        root: path.join(currentDirectory, 'resources', 'images'),
        prefix: '/images',
      })
        .get('/favicon.svg', async (_, res) => {
          return res.sendFile(
            'favicon.svg',
            path.join(currentDirectory, 'resources', 'images'),
          );
        })
        .get('/favicon.ico', async (_, res) => {
          return res.sendFile(
            'favicon.ico',
            path.join(currentDirectory, 'resources', 'images'),
          );
        });
      done();
    })

    .register(async (f) => {
      await f.register(fpStatic, {
        root: path.join(opts.database, 'cache', 'images'),
        decorateReply: false,
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

      f.delete('/api/cache/images', async (req, res) => {
        try {
          await req.serverCtx.cacheImageService.clearCache();
          return res.status(200).send({ msg: 'Cache Image are Cleared' });
        } catch (error) {
          logger.error('Error deleting cached images', error);
          return res.status(500).send('error');
        }
      });
    })
    .register(async (f) => {
      f.addHook('onError', (req, _, error, done) => {
        logger.error(req.routeOptions.config.url, error);
        done();
      });
      await f
        .register(plexServersRouter)
        .register(ffmpegSettingsRouter)
        .register(plexSettingsRouter)
        .register(xmlTvSettingsRouter)
        .register(hdhrSettingsRouter)
        .register(guideRouter)
        .register(apiRouter, { prefix: '/api' });
    })
    .register(videoRouter)
    .register(ctx.hdhrService.createRouter())
    .register(async (f) => {
      await f.register(fpStatic, {
        root: path.join(currentDirectory, 'web'),
        prefix: '/web',
      });
      f.get('/web', async (_, res) =>
        res.sendFile('index.html', path.join(currentDirectory, 'web')),
      );
    });

  await updateXMLPromise;

  const host = process.env['TUNARR_BIND_ADDR'] ?? 'localhost';
  app.listen(
    {
      host,
      port: opts.port,
    },
    () => {
      logger.info(`HTTP server running on port: http://${host}:${opts.port}`);
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
