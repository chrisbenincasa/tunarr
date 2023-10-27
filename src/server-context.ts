import db from 'diskdb';
import { once } from 'lodash';
import { argv } from './args';
import * as channelCache from './channel-cache';
import { ChannelDB } from './dao/channel-db';
import path from 'path';
import { FillerDB } from './dao/filler-db';
import { CacheImageService } from './services/cache-image-service';
import { FileCacheService } from './services/file-cache-service';
import { M3uService } from './services/m3u-service';
import * as dbMigration from './database-migration';
import fs from 'fs';
import { TVGuideService } from './services/tv-guide-service';
import * as xmltv from './xmltv';
import { EventService } from './services/event-service';
import { hdhr } from './hdhr';

function initDB(db, channelDB) {
  if (!fs.existsSync(process.env.DATABASE + '/images/dizquetv.png')) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources/dizquetv.png')),
    );
    fs.writeFileSync(process.env.DATABASE + '/images/dizquetv.png', data);
  }
  dbMigration.initDB(db, channelDB, __dirname);
  if (!fs.existsSync(process.env.DATABASE + '/font.ttf')) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources/font.ttf')),
    );
    fs.writeFileSync(process.env.DATABASE + '/font.ttf', data);
  }
  if (!fs.existsSync(process.env.DATABASE + '/images/dizquetv.png')) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources/dizquetv.png')),
    );
    fs.writeFileSync(process.env.DATABASE + '/images/dizquetv.png', data);
  }
  if (
    !fs.existsSync(process.env.DATABASE + '/images/generic-error-screen.png')
  ) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources/generic-error-screen.png')),
    );
    fs.writeFileSync(
      process.env.DATABASE + '/images/generic-error-screen.png',
      data,
    );
  }
  if (
    !fs.existsSync(process.env.DATABASE + '/images/generic-offline-screen.png')
  ) {
    let data = fs.readFileSync(
      path.resolve(
        path.join(__dirname, 'resources/generic-offline-screen.png'),
      ),
    );
    fs.writeFileSync(
      process.env.DATABASE + '/images/generic-offline-screen.png',
      data,
    );
  }
  if (
    !fs.existsSync(process.env.DATABASE + '/images/generic-music-screen.png')
  ) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources/generic-music-screen.png')),
    );
    fs.writeFileSync(
      process.env.DATABASE + '/images/generic-music-screen.png',
      data,
    );
  }
  if (!fs.existsSync(process.env.DATABASE + '/images/loading-screen.png')) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources/loading-screen.png')),
    );
    fs.writeFileSync(process.env.DATABASE + '/images/loading-screen.png', data);
  }
  if (!fs.existsSync(path.join(process.env.DATABASE || '', 'custom.css'))) {
    let data = fs.readFileSync(
      path.resolve(path.join(__dirname, 'resources', 'default-custom.css')),
    );
    fs.writeFileSync(path.join(process.env.DATABASE || '', 'custom.css'), data);
  }
}

export const serverContext = once(() => {
  db.connect(process.env.DATABASE, [
    'channels',
    'plex-servers',
    'ffmpeg-settings',
    'plex-settings',
    'xmltv-settings',
    'hdhr-settings',
    'db-version',
    'client-id',
    'cache-images',
    'settings',
  ]);

  const channelDB = new ChannelDB(path.join(argv.database, 'channels'));
  const fillerDB = new FillerDB(
    path.join(argv.database, 'filler'),
    channelDB,
    channelCache,
  );
  const fileCache = new FileCacheService(path.join(argv.database, 'cache'));
  const cacheImageService = new CacheImageService(db, fileCache);
  const m3uService = new M3uService(channelDB, fileCache, channelCache);
  const eventService = new EventService();

  initDB(db, channelDB);

  const guideService = new TVGuideService(
    xmltv,
    db,
    cacheImageService,
    eventService,
  );

  return {
    db,
    channelDB,
    fillerDB,
    fileCache,
    cacheImageService,
    m3uService,
    eventService,
    guideService,
    hdhrService: hdhr(db, channelDB),
  };
});
