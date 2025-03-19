import { container } from '@/container.js';
import { KEYS } from '@/types/inject.js';
import type { ServerType } from '@/types/serverType.js';
import { getTunarrVersion } from '@/util/version.js';
import cors from '@fastify/cors';
import fastifyMultipart from '@fastify/multipart';
import fpStatic from '@fastify/static';
import fastifySwagger from '@fastify/swagger';
import fastify, { FastifySchema } from 'fastify';
import fastifyGracefulShutdown from 'fastify-graceful-shutdown';
import fp from 'fastify-plugin';
import fastifyPrintRoutes from 'fastify-print-routes';
import {
  ZodTypeProvider,
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import type { RouteOptions } from 'fastify/types/route.js';
import { inject, injectable } from 'inversify';
import {
  isArray,
  isEmpty,
  isNumber,
  isString,
  isUndefined,
  round,
  values,
} from 'lodash-es';
import schedule from 'node-schedule';
import path, { dirname } from 'node:path';
import 'reflect-metadata';
import { z } from 'zod';
import { HdhrApiRouter } from './api/hdhrApi.js';
import { apiRouter } from './api/index.js';
import { streamApi } from './api/streamApi.js';
import { videoApiRouter } from './api/videoApi.js';
import { FfmpegInfo } from './ffmpeg/ffmpegInfo.js';
import {
  type ServerOptions,
  initializeSingletons,
  serverOptions,
} from './globals.js';
import { ServerContext, ServerRequestContext } from './ServerContext.js';
import { GlobalScheduler, scheduleJobs } from './services/Scheduler.ts';
import { initPersistentStreamCache } from './stream/ChannelCache.js';
import { UpdateXmlTvTask } from './tasks/UpdateXmlTvTask.js';
import { TUNARR_ENV_VARS } from './util/env.ts';
import { fileExists } from './util/fsUtil.js';
import { filename, isNonEmptyString, run } from './util/index.js';
import { type Logger, RootLogger } from './util/logging/LoggerFactory.js';

const currentDirectory = dirname(filename(import.meta.url));

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

@injectable()
export class Server {
  private app: ServerType;

  constructor(
    @inject(KEYS.ServerOptions) private serverOptions: ServerOptions,
    @inject(ServerContext) private serverContext: ServerContext,
    @inject(KEYS.Logger) private logger: Logger,
  ) {}

  async init() {
    this.logger.info(
      'Using Tunarr database directory: %s',
      this.serverOptions.databaseDirectory,
    );

    // TODO: Use injector
    initializeSingletons(this.serverContext);
    await this.serverContext.m3uService.clearCache();
    await this.serverContext.channelLineupMigrator.run();

    // TODO add legacy migration
    const legacyDbPath = await legacyDizquetvDirectoryPath();
    if (
      (this.serverContext.settings.migrationState.isFreshSettings ||
        this.serverOptions.force_migration) &&
      isNonEmptyString(legacyDbPath)
    ) {
      this.logger.info('Migrating from legacy database folder...');
      await this.serverContext.legacyDBMigrator
        .migrateFromLegacyDb(legacyDbPath)
        .catch((e) => {
          this.logger.error('Failed to migrate from legacy DB: %O', e);
        });
    } else if (
      !this.serverContext.settings.migrationState.isFreshSettings &&
      isNonEmptyString(legacyDbPath)
    ) {
      this.logger.info(
        'Found legacy dizquetv database folder at %s, but not migrating because an existing Tunarr database was also found',
        legacyDbPath,
      );
    } else if (isEmpty(legacyDbPath)) {
      this.logger.info(
        'No legacy dizquetv database folder found when searching at: %s',
        path.join(process.cwd(), '.dizquetv'),
      );
    }

    if (
      await fileExists(
        this.serverContext.settings.ffmpegSettings().ffmpegExecutablePath,
      )
    ) {
      container
        .get<FfmpegInfo>(FfmpegInfo)
        .seed()
        .then(() => {
          this.logger.debug('Successfully seeded ffmpeg info cache.');
        })
        .catch((e) => {
          this.logger.error(e, 'Error while seeing ffmpeg info cache.');
        });
    }

    scheduleJobs(this.serverContext);
    await this.serverContext.fixerRunner.runFixers();
    await initPersistentStreamCache();

    const updateXMLPromise = GlobalScheduler.runScheduledJobNow(
      UpdateXmlTvTask.ID,
    );

    this.app = fastify({
      logger: false,
      bodyLimit: 50 * 1024 * 1024,
    })
      .setValidatorCompiler(validatorCompiler)
      .setSerializerCompiler(serializerCompiler)
      .withTypeProvider<ZodTypeProvider>();

    if (serverOptions().printRoutes) {
      await this.app.register(
        fp((f, opts, done) =>
          fastifyPrintRoutes(
            f,
            {
              ...opts,
              querystring: false,
              filter(route: RouteOptions) {
                return (
                  route.method !== 'HEAD' &&
                  route.method !== 'OPTIONS' &&
                  !route.url.startsWith('/docs') &&
                  !route.schema?.hide
                );
              },
              compact: true,
            },
            done,
          ),
        ),
      );
    }

    await this.app
      .decorateRequest('disableRequestLogging', false)
      .decorateRequest('logRequestAtLevel', 'http')
      .register(fastifySwagger, {
        openapi: {
          info: {
            title: 'Tunarr',
            description: 'Tunarr API',
            version: getTunarrVersion(),
          },
          servers: [],
          tags: [
            {
              name: 'Channels',
            },
            {
              name: 'Custom Shows',
            },
            {
              name: 'Filler Lists',
            },
            {
              name: 'Guide',
            },
            {
              name: 'Media Source',
            },
            {
              name: 'Programs',
            },
            {
              name: 'Sessions',
            },
            {
              name: 'Streaming',
            },
            {
              name: 'HDHR',
            },
            {
              name: 'Settings',
            },
            {
              name: 'System',
            },
            {
              name: 'Tasks',
            },
            {
              name: 'Debug',
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
      // Hitting api docs on local instances of Tunarr is blocked on
      // https://github.com/scalar/scalar/pull/4528
      // .register(fastifyApiReference, {
      //   routePrefix: '/docs',
      //   configuration: {
      //     spec: {
      //       content: () => this.app.swagger(),
      //     },
      //   },
      // })
      .register(cors, {
        origin: '*', // Testing
      })
      .register(fastifyMultipart)
      .addHook('onRequest', (_req, _res, done) => {
        ServerRequestContext.create(container.get(ServerContext), done);
      })
      .register(
        fp((f, _, done) => {
          f.decorateRequest('serverCtx');
          f.addHook('onRequest', (req, _res, done) => {
            req.serverCtx = ServerRequestContext.currentServerContext()!;
            done();
          });
          done();
        }),
      );

    this.app.addHook('onResponse', (req, rep, done) => {
      if (req.routeOptions.config.disableRequestLogging) {
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

      this.logger[req.routeOptions.config.logAtLevel ?? 'http'](
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

    this.serverContext.eventService.setup(this.app);

    // API Routers
    await this.app
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
          root: path.join(
            serverOptions().databaseDirectory,
            'images',
            'uploads',
          ),
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

      .register(async (f: ServerType) => {
        await f.register(fpStatic, {
          root: path.join(
            this.serverOptions.databaseDirectory,
            'cache',
            'images',
          ),
          decorateReply: false,
          serve: false, // Use the interceptor
        });
        f.get(
          '/cache/images/:hash',
          {
            schema: {
              hide: true,
              params: z.object({ hash: z.string() }),
            },
            // Workaround for https://github.com/fastify/fastify/issues/4859
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            onRequest: (req, res) => {
              return req.serverCtx.cacheImageService.routerInterceptor(
                req.params.hash,
                res,
              );
            },
          },
          async (req, res) => {
            return res.sendFile(req.params.hash);
          },
        );

        f.delete(
          '/api/cache/images',
          {
            schema: {
              // TODO: Expose and add button to UI
              hide: true,
            },
          },
          async (req, res) => {
            try {
              await req.serverCtx.cacheImageService.clearCache();
              return res.status(200).send({ msg: 'Cache Image are Cleared' });
            } catch (error) {
              this.logger.error('Error deleting cached images', error);
              return res.status(500).send('error');
            }
          },
        );
      })
      .register(async (f) => {
        f.addHook('onError', (req, _, error, done) => {
          this.logger.error(error, req.routeOptions.config.url);
          done();
        });
        await f
          .get('/', { schema: { hide: true } }, async (_, res) =>
            res.redirect('/web', 302),
          )
          .register(new HdhrApiRouter().router)
          .register(apiRouter, { prefix: '/api' });
      })
      .register(videoApiRouter)
      .register(streamApi)
      // Serve the webapp
      .register(
        async (f) => {
          // For assets that exist...
          await f.register(fpStatic, {
            root: path.join(currentDirectory, 'web'),
            schemaHide: true,
          });
          // Make it work with just '/web' and not '/web/;
          f.get(
            '/',
            { schema: { hide: true }, config: { disableRequestLogging: true } },
            async (_, res) => {
              return res.sendFile(
                'index.html',
                path.join(currentDirectory, 'web'),
              );
            },
          );
          // client side routing 'hack'. This makes navigating to other client-side
          // routes work as expected.
          f.setNotFoundHandler(async (_, res) => {
            return res.sendFile(
              'index.html',
              path.join(currentDirectory, 'web'),
            );
          });
        },
        { prefix: '/web' },
      )
      .register(fastifyGracefulShutdown);

    await updateXMLPromise;

    this.app.after(() => {
      this.app.gracefulShutdown(async (signal) => {
        this.logger.info(
          'Received exit signal %s, attempting graceful shutdown',
          signal,
        );

        const t = new Date().getTime();

        try {
          this.serverContext.eventService.push({
            type: 'lifecycle',
            message: `Initiated Server Shutdown`,
            detail: {
              time: t,
            },
            level: 'warning',
          });
        } catch (e) {
          this.logger.debug(e, 'Error sending shutdown signal to frontend');
        }

        try {
          this.logger.debug('Pausing all on-demand channels');
          await this.serverContext.onDemandChannelService.pauseAllChannels();
        } catch (e) {
          this.logger.error(e, 'Error pausing on-demand channels');
        }

        this.logger.debug('Shutting down all sessions');
        for (const session of values(
          this.serverContext.sessionManager.allSessions(),
        )) {
          try {
            await session.stop();
          } catch (e) {
            this.logger.error(
              e,
              'Error shutting down session (id=%s, type%s)',
              session.id,
              session.sessionType,
            );
          }
        }

        this.serverContext.eventService.close();

        try {
          this.logger.debug('Waiting for pending jobs to complete!');
          await Promise.race([
            schedule.gracefulShutdown(),
            new Promise<boolean>((resolve) => {
              setTimeout(() => {
                resolve(false);
              }, 1000);
            }).then(() => {
              throw new Error(
                'Scheduled job graceful shutdown timeout reached.',
              );
            }),
          ]);
        } catch (e) {
          this.logger.error(e, 'Scheduled job graceful shutdown failed.');
        }

        this.logger.debug('All done, shutting down!');
      });
    });
  }

  async initAndRun() {
    const start = performance.now();
    await this.init();

    const host = process.env[TUNARR_ENV_VARS.BIND_ADDR_ENV_VAR] ?? '0.0.0.0';

    await this.app.listen({
      host,
      port: this.serverOptions.port,
    });

    this.logger.debug(
      'Took %d ms for the server to start',
      round(performance.now() - start, 2),
    );
    this.logger.info(
      `HTTP server listening on host:port: http://${
        host === '0.0.0.0' ? '*' : host
      }:${this.serverOptions.port}`,
    );

    const hdhrSettings = this.serverContext.settings.hdhrSettings();
    if (hdhrSettings.autoDiscoveryEnabled) {
      await this.serverContext.hdhrService.ssdp.start();
    }

    this.serverContext.eventService.push({
      type: 'lifecycle',
      message: `Server Started`,
      detail: {
        time: new Date().getTime(),
      },
      level: 'success',
    });
  }

  getOpenApiDocument() {
    return this.app.swagger();
  }

  close() {
    if (this.app) {
      return this.app.close();
    }
    return Promise.resolve();
  }
}
