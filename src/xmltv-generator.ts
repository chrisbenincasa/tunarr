import { compact } from 'lodash-es';
import { ImmutableChannel, getDB } from './dao/db.js';
import createLogger from './logger.js';
import { Plex } from './plex.js';
import { serverContext } from './server-context.js';

const logger = createLogger(import.meta);

const updateXML = async () => {
  const ctx = await serverContext();

  let getChannelsCached = async () => {
    let channelNumbers = await ctx.channelDB.getAllChannelNumbers();
    return compact(
      await Promise.all(
        channelNumbers.map(async (x) => {
          return ctx.channelCache.getChannelConfig(x);
        }),
      ),
    );
  };

  let channels: ImmutableChannel[] = [];

  try {
    channels = await ctx.channelCache.getAllChannels();
    let xmltvSettings = (await getDB()).xmlTvSettings();
    let t = ctx.guideService.prepareRefresh(
      channels,
      xmltvSettings.refreshHours * 60 * 60 * 1000,
    );
    channels = [];

    await ctx.guideService.refresh(t);
    xmltvInterval.lastRefresh = new Date();
    logger.info(
      'XMLTV Updated at ' + xmltvInterval.lastRefresh.toLocaleString(),
    );
  } catch (err) {
    logger.error('Unable to update TV guide?', err);
    return;
  }
  channels = await getChannelsCached();

  let plexServers = ctx.dbAccess.plexServers().getAll();
  for (let i = 0, l = plexServers.length; i < l; i++) {
    // Foreach plex server
    let plex = new Plex(plexServers[i]);
    let dvrs;
    if (
      !plexServers[i].sendGuideUpdates &&
      !plexServers[i].sendChannelUpdates
    ) {
      continue;
    }
    try {
      dvrs = await plex.GetDVRS(); // Refresh guide and channel mappings
    } catch (err) {
      logger.error(
        `Couldn't get DVRS list from ${plexServers[i].name}. This error will prevent 'refresh guide' or 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
        err,
      );
      continue;
    }
    if (plexServers[i].sendGuideUpdates) {
      try {
        await plex.RefreshGuide(dvrs);
      } catch (err) {
        logger.error(
          `Couldn't tell Plex ${plexServers[i].name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.`,
          err,
        );
      }
    }
    if (plexServers[i].sendChannelUpdates && channels.length !== 0) {
      try {
        await plex.RefreshChannels(channels, dvrs);
      } catch (err) {
        logger.error(
          `Couldn't tell Plex ${plexServers[i].name} to refresh channels for some reason. This error will prevent 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
          err,
        );
      }
    }
  }
};

export const xmltvInterval = {
  interval: null as NodeJS.Timeout | null,
  lastRefresh: null as Date | null,
  updateXML,
  startInterval: async () => {
    const ctx = await serverContext();
    let xmltvSettings = ctx.dbAccess.xmlTvSettings();
    if (xmltvSettings.refreshHours !== 0) {
      xmltvInterval.interval = setInterval(
        async () => {
          try {
            await xmltvInterval.updateXML();
          } catch (err) {
            logger.error('update XMLTV error', err);
          }
        },
        xmltvSettings.refreshHours * 60 * 60 * 1000,
      );
    }
  },
  restartInterval: () => {
    if (xmltvInterval.interval !== null) clearInterval(xmltvInterval.interval);
    xmltvInterval.startInterval();
  },
};
