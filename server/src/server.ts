import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fpStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import { RequestContext } from '@mikro-orm/core';
import fastify, { FastifySchema } from 'fastify';
import fp from 'fastify-plugin';
import fastifyPrintRoutes from 'fastify-print-routes';
import {
  ZodTypeProvider,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { FastifyRouteConfig } from 'fastify/types/route.js';
import fs from 'node:fs/promises';
import { isArray, isNumber, isString, isUndefined, round } from 'lodash-es';
import schedule from 'node-schedule';
import path, { dirname } from 'path';
import { HdhrApiRouter } from './api/hdhrApi.js';
import { hlsApi } from './api/hlsApi.js';
import { apiRouter } from './api/index.js';
import { videoRouter } from './api/videoApi.js';
import { EntityManager, initOrm } from './dao/dataSource.js';
import { LegacyDbMigrator } from './dao/legacy_migration/legacyDbMigration.js';
import { getSettings } from './dao/settings.js';
import { ServerOptions, serverOptions } from './globals.js';
import { ServerRequestContext, serverContext } from './serverContext.js';
import { GlobalScheduler, scheduleJobs } from './services/scheduler.js';
import { initPersistentStreamCache } from './stream/ChannelCache.js';
import { UpdateXmlTvTask } from './tasks/UpdateXmlTvTask.js';
import { runFixers } from './tasks/fixers/index.js';
import { filename, isNonEmptyString, run } from './util/index.js';
import { LoggerFactory, RootLogger } from './util/logging/LoggerFactory.js';
import { initDirectDbAccess } from './dao/direct/directDbAccess.js';
import { OnDemandChannelService } from './services/OnDemandChannelService.js';
import constants from '@tunarr/shared/constants';
import { copyDirectoryContents, fileExists } from './util/fsUtil.js';

const currentDirectory = dirname(filename(import.meta.url));

async function migrateFromPreAlphaDefaultDb(targetDir: string) {
  // In versions <=0.3.2, the default database directory was located
  // at process.cwd()/.tunarr
  const preAlphaPath = path.join(process.cwd(), constants.DEFAULT_DATA_DIR);
  const hasPreAlphaDefaultDb = await fileExists(preAlphaPath);
  if (hasPreAlphaDefaultDb) {
    console.log('has', hasPreAlphaDefaultDb);
    await copyDirectoryContents(preAlphaPath, targetDir);
  }
}

/**
 * Initializes the Tunarr "database" directory at the configured location, including
 * subdirectories
 * @returns True if an existing database directory was found
 */
export async function initDbDirectories() {
  // Early init, have to use the non-settings-based root Logger
  const opts = serverOptions();
  const hasTunarrDb = await fileExists(opts.databaseDirectory);
  if (!hasTunarrDb) {
    RootLogger.debug(
      `Existing database at ${opts.databaseDirectory} not found`,
    );
    await fs.mkdir(opts.databaseDirectory, { recursive: true });
    await migrateFromPreAlphaDefaultDb(opts.databaseDirectory);
    await getSettings().flush();
  }

  for (const subpaths of [
    ['channel-lineups'],
    ['images'],
    ['cache'],
    ['cache', 'images'],
  ]) {
    const pathToCheck = path.join(opts.databaseDirectory, ...subpaths);
    if (!(await fileExists(pathToCheck))) {
      RootLogger.debug(`Creating path at ${pathToCheck}`);
      await fs.mkdir(pathToCheck);
    }
  }

  // TODO: This will be an option that the user can set...
  if (!(await fileExists(path.join(process.cwd(), 'streams')))) {
    await fs.mkdir(path.join(process.cwd(), 'streams'));
  }

  return hasTunarrDb;
}

async function legacyDizquetvDirectoryPath() {
  const legacyDbLocation = path.join(process.cwd(), '.dizquetv');
  RootLogger.info(
    `Searching for legacy dizquetv directory at ${legacyDbLocation}`,
  );
  const hasLegacyDb = await fileExists(legacyDbLocation);
  if (hasLegacyDb) {
    RootLogger.info(`A legacy .dizquetv database was located.`);
    return legacyDbLocation;
  }

  return;
}

export async function initServer(opts: ServerOptions) {
  await initDbDirectories();
  const settingsDb = getSettings();
  LoggerFactory.initialize(settingsDb);

  const logger = LoggerFactory.child({ caller: import.meta });

  const orm = await initOrm();
  initDirectDbAccess(opts);

  const ctx = serverContext();

  const legacyDbPath = await legacyDizquetvDirectoryPath();
  if (
    (ctx.settings.migrationState.isFreshSettings || opts.force_migration) &&
    isNonEmptyString(legacyDbPath)
  ) {
    logger.info('Migrating from legacy database folder...');
    await new LegacyDbMigrator(settingsDb, legacyDbPath)
      .migrateFromLegacyDb()
      .catch((e) => {
        logger.error('Failed to migrate from legacy DB: %O', e);
      });
  }

  scheduleJobs(ctx);
  await runFixers();
  await initPersistentStreamCache();

  const updateXMLPromise = GlobalScheduler.getScheduledJob(
    UpdateXmlTvTask.ID,
  ).runNow();

  const app = fastify({
    logger: false,
    bodyLimit: 50 * 1024 * 1024,
  })
    .setValidatorCompiler(validatorCompiler)
    .setSerializerCompiler(serializerCompiler)
    .withTypeProvider<ZodTypeProvider>();

  if (serverOptions().printRoutes) {
    await app.register(
      fp((f, opts, done) =>
        fastifyPrintRoutes(
          f,
          {
            ...opts,
            querystring: false,
            filter(route: FastifyRouteConfig) {
              return (
                route.method !== 'HEAD' &&
                route.method !== 'OPTIONS' &&
                !route.url.startsWith('/docs')
              );
            },
            compact: true,
          },
          done,
        ),
      ),
    );
  }

  await app
    .decorateRequest('disableRequestLogging', false)
    .decorateRequest('logRequestAtLevel', 'http')
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
    // .register(fastifySwaggerUi, {
    //   routePrefix: '/docs',
    //   baseDir:
    //     isProduction && process.argv.length > 1
    //       ? join(dirname(process.argv[1]), 'static')
    //       : undefined,
    // })
    .register(cors, {
      origin: '*', // Testing
    })
    .register(fastifyMultipart)
    .addHook('onRequest', (_req, _rep, done) =>
      RequestContext.create(orm.em, done),
    )
    .addHook('onRequest', (_req, _res, done) => {
      ServerRequestContext.create(serverContext(), done);
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

  app.addHook('onResponse', (req, rep, done) => {
    if (req['disableRequestLogging']) {
      return;
    }
    const length = rep.getHeader('content-length');
    const lengthStr = run(() => {
      if (isString(length) || isNumber(length)) {
        return ` (${length} bytes) `;
      } else if (isArray(length) && length.length > 0) {
        return ` (${length[0]} bytes) `;
      } else {
        return ' ';
      }
    });

    const roundedTime = round(rep.elapsedTime, 4);

    logger[req['logRequestAtLevel'] ?? 'http'](
      `${req.method} ${req.url} ${rep.statusCode} -${lengthStr}${roundedTime}ms`,
      {
        req: {
          method: req.method,
          url: req.url,
          status: rep.statusCode,
          elapsedTime: roundedTime,
        },
      },
    );
    done();
  });

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
        root: path.join(serverOptions().databaseDirectory, 'images', 'uploads'),
        prefix: '/images/uploads',
      })
        .register(fpStatic, {
          root: path.join(currentDirectory, 'resources', 'images'),
          prefix: '/images',
          decorateReply: false,
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
        root: path.join(opts.databaseDirectory, 'cache', 'images'),
        decorateReply: false,
        serve: false, // Use the interceptor
      });
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
        logger.error(error, req.routeOptions.config.url);
        done();
      });
      await f
        .get('/', async (_, res) => res.redirect(302, '/web'))
        .register(new HdhrApiRouter().router)
        .register(apiRouter, { prefix: '/api' });
    })
    .register(videoRouter)
    .register(hlsApi)
    // Serve the webapp
    .register(
      async (f) => {
        // For assets that exist...
        await f.register(fpStatic, {
          root: path.join(currentDirectory, 'web'),
        });
        f.addHook('onRequest', (req, _, done) => {
          req.disableRequestLogging = true;
          done();
        });
        // Make it work with just '/web' and not '/web/;
        f.get('/', async (_, res) => {
          return res.sendFile('index.html', path.join(currentDirectory, 'web'));
        });
        // client side routing 'hack'. This makes navigating to other client-side
        // routes work as expected.
        f.setNotFoundHandler(async (_, res) => {
          return res.sendFile('index.html', path.join(currentDirectory, 'web'));
        });
      },
      { prefix: '/web' },
    );

  await updateXMLPromise;

  const host = process.env['TUNARR_BIND_ADDR'] ?? 'localhost';

  const url = await app
    .addHook('onClose', async () => {
      const ctx = serverContext();
      const t = new Date().getTime();
      ctx.eventService.push({
        type: 'lifecycle',
        message: `Initiated Server Shutdown`,
        detail: {
          time: t,
        },
        level: 'warning',
      });

      logger.info('Received exit signal, attempting graceful shutdown');

      await new OnDemandChannelService(ctx.channelDB).pauseAllChannels();

      try {
        logger.info('Waiting for pending jobs to complete');
        await schedule.gracefulShutdown();
      } catch (e) {
        logger.error('Scheduled job graceful shutdown failed.', e);
      }
    })
    .listen({
      host,
      port: opts.port,
    });

  logger.info(`HTTP server running on port: http://${host}:${opts.port}`);
  const hdhrSettings = ctx.settings.hdhrSettings();
  if (hdhrSettings.autoDiscoveryEnabled) {
    await ctx.hdhrService.ssdp.start();
  }

  ctx.eventService.push({
    type: 'lifecycle',
    message: `Server Started`,
    detail: {
      time: new Date().getTime(),
    },
    level: 'success',
  });

  return { app, url };
}
