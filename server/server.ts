// import express, { Request } from 'express';
import cors from '@fastify/cors';
import middie from '@fastify/middie';
import fpStatic from '@fastify/static';
import fastify from 'fastify';
import fp from 'fastify-plugin';
import fastifyPrintRoutes from 'fastify-print-routes';
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
import { ffmpegSettingsRouter } from './api/ffmpegSettingsApi.js';
import { fillerRouter } from './api/filllerApi.js';
import { guideRouter } from './api/guideApi.js';
import { hdhrSettingsRouter } from './api/hdhrSettingsApi.js';
import { plexServersRouter } from './api/plexServersApi.js';
import { plexSettingsRouter } from './api/plexSettingsApi.js';
import { xmlTvSettingsRouter } from './api/xmltvSettingsApi.js';
import constants from './constants.js';
import { serverOptions } from './globals.js';
import createLogger from './logger.js';
import { serverContext } from './serverContext.js';
import { ServerOptions } from './types.js';
import { time } from './util.js';
import { videoRouter } from './video2.js';
import { xmltvInterval } from './xmltvGenerator.js';
import { debugRouter } from './api/debugApi.js';

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
  if (!fs.existsSync(opts.database)) {
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

  if (!fs.existsSync(path.join(opts.database, 'images'))) {
    fs.mkdirSync(path.join(opts.database, 'images'));
  }
  if (!fs.existsSync(path.join(opts.database, 'channels'))) {
    fs.mkdirSync(path.join(opts.database, 'channels'));
  }
  if (!fs.existsSync(path.join(opts.database, 'filler'))) {
    fs.mkdirSync(path.join(opts.database, 'filler'));
  }
  if (!fs.existsSync(path.join(opts.database, 'custom-shows'))) {
    fs.mkdirSync(path.join(opts.database, 'custom-shows'));
  }
  if (!fs.existsSync(path.join(opts.database, 'cache'))) {
    fs.mkdirSync(path.join(opts.database, 'cache'));
  }
  if (!fs.existsSync(path.join(opts.database, 'cache', 'images'))) {
    fs.mkdirSync(path.join(opts.database, 'cache', 'images'));
  }
}

// type AppContext = {
//   serverCtx: ServerContext;
// };

export async function initServer(opts: ServerOptions) {
  await time('initDbDirectories', () => initDbDirectories);

  const ctx = await time('generateServerContext', () => serverContext());

  const updateXMLPromise = time<Promise<void>>('xmltv.update', () =>
    xmltvInterval.updateXML(),
  ).then(() => xmltvInterval.startInterval());

  const app = fastify({ logger: false, bodyLimit: 50 * 1024 });
  await app
    .register(middie)
    .register(cors)
    .register(fastifyPrintRoutes)
    .register(
      fp((f, _, done) => {
        f.decorateRequest('serverCtx', null);
        f.addHook('onRequest', async (req) => {
          req.serverCtx = await serverContext();
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

  app.get('/version.js', async (_, res) => {
    return res.header('content-type', 'application/javascript').status(200)
      .send(`
        function setUIVersionNow() {
            setTimeout( setUIVersionNow, 1000);
            var element = document.getElementById("uiversion");
            if (element != null) {
                element.innerHTML = "${constants.VERSION_NAME}";
            }
        }
        setTimeout( setUIVersionNow, 1000);
    `);
  });

  await app
    .use('/images', serveStatic(path.join(opts.database, 'images')))
    .use(serveStatic(fileURLToPath(new URL('../web/public', import.meta.url))))
    .use('/images', serveStatic(path.join(opts.database, 'images')))
    // .use('/cache/images', ctx.cacheImageService.routerInterceptor())
    // .get<{ Params: { hash: string } }>(
    //   '/cache/images/:hash',
    //   {
    //     // Workaround for https://github.com/fastify/fastify/issues/4859
    //     // eslint-disable-next-line @typescript-eslint/no-misused-promises
    //     onRequest: (req, res) =>
    //       ctx.cacheImageService.routerInterceptor(req, res),
    //   },
    //   (req, res) => {

    //   },
    // )
    // .use(
    //   '/cache/images',
    //   serveStatic(path.join(opts.database, 'cache', 'images')),
    // )
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
    .register(debugRouter);

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
      const hdhrSettings = ctx.dbAccess.hdhrSettings();
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
}

function _wait(t: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
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
  await _wait(2000);
});
onShutdown('xmltv-writer', [], async () => {
  const ctx = await serverContext();
  await ctx.xmltv.shutdown();
});
