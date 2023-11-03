import express, { Request } from 'express';
import fileUpload from 'express-fileupload';
import fs from 'fs';
import morgan from 'morgan';
import { onShutdown } from 'node-graceful-shutdown';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import path from 'path';
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
import { video } from './video.js';
import { xmltvInterval } from './xmltvGenerator.js';
import cors from 'cors';

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

export async function initServer(opts: ServerOptions) {
  initDbDirectories();

  const ctx = await serverContext();

  await xmltvInterval.updateXML();
  await xmltvInterval.startInterval();

  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '50mb' }));
  app.use(express.urlencoded({ extended: true }));
  app.use(async (req: Request, _res, next) => {
    req.ctx = await serverContext();
    next();
  });
  ctx.eventService.setup(app);

  app.use(
    fileUpload({
      createParentPath: true,
    }),
  );

  app.use(
    morgan(':method :url :status :res[content-length] - :response-time ms', {
      stream: {
        write: (message) => logger.http(message.trim()),
      },
    }),
  );

  app.get('/version.js', (_, res) => {
    res.writeHead(200, {
      'Content-Type': 'application/javascript',
    });

    res.write(`
        function setUIVersionNow() {
            setTimeout( setUIVersionNow, 1000);
            var element = document.getElementById("uiversion");
            if (element != null) {
                element.innerHTML = "${constants.VERSION_NAME}";
            }
        }
        setTimeout( setUIVersionNow, 1000);
    `);
    res.end();
  });
  app.use('/images', express.static(path.join(opts.database, 'images')));
  app.use(
    express.static(fileURLToPath(new URL('../web/public', import.meta.url))),
  );
  app.use('/images', express.static(path.join(opts.database, 'images')));
  app.use('/cache/images', ctx.cacheImageService.routerInterceptor());
  app.use(
    '/cache/images',
    express.static(path.join(opts.database, 'cache', 'images')),
  );
  app.use(
    '/favicon.svg',
    express.static(path.join(__dirname, 'resources', 'favicon.svg')),
  );
  app.use(
    '/custom.css',
    express.static(path.join(opts.database, 'custom.css')),
  );

  // API Routers
  app.use(plexServersRouter);
  app.use(channelsRouter);
  app.use(fillerRouter);
  app.use(customShowRouter);
  app.use(ffmpegSettingsRouter);
  app.use(plexSettingsRouter);
  app.use(xmlTvSettingsRouter);
  app.use(hdhrSettingsRouter);
  app.use(channelToolRouter);
  app.use(guideRouter);
  app.use(miscRouter);
  app.use('/api/cache/images', ctx.cacheImageService.apiRouters());

  app.use(video(ctx.fillerDB));
  app.use(ctx.hdhrService.router);
  app.listen(opts.port, () => {
    logger.info(`HTTP server running on port: http://*:${opts.port}`);
    const hdhrSettings = ctx.dbAccess.hdhrSettings();
    if (hdhrSettings.autoDiscoveryEnabled) {
      ctx.hdhrService.ssdp.start();
    }
  });
}

function _wait(t: number) {
  return new Promise((resolve) => {
    setTimeout(resolve, t);
  });
}

async function sendEventAfterTime() {
  const ctx = await serverContext();
  const t = new Date().getTime();
  await _wait(20000);
  ctx.eventService.push('lifecycle', {
    message: `Server Started`,
    detail: {
      time: t,
    },
    level: 'success',
  });
}
sendEventAfterTime();

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
