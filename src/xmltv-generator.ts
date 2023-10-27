import { Plex } from './plex';
import { serverContext } from './server-context';
import * as channelCache from './channel-cache';

const updateXML = async () => {
  const ctx = serverContext();

  let getChannelsCached = async () => {
    let channelNumbers = await ctx.channelDB.getAllChannelNumbers();
    return await Promise.all(
      channelNumbers.map(async (x) => {
        return (await channelCache.getChannelConfig(ctx.channelDB, x))[0];
      }),
    );
  };

  let channels: any[] = [];

  try {
    channels = await getChannelsCached();
    let xmltvSettings = ctx.db['xmltv-settings'].find()[0];
    let t = ctx.guideService.prepareRefresh(
      channels,
      xmltvSettings.cache * 60 * 60 * 1000,
    );
    channels = [];

    await ctx.guideService.refresh(t);
    xmltvInterval.lastRefresh = new Date();
    console.log(
      'XMLTV Updated at ',
      xmltvInterval.lastRefresh.toLocaleString(),
    );
  } catch (err) {
    console.error('Unable to update TV guide?', err);
    return;
  }
  channels = await getChannelsCached();

  let plexServers = ctx.db['plex-servers'].find();
  for (let i = 0, l = plexServers.length; i < l; i++) {
    // Foreach plex server
    let plex = new Plex(plexServers[i]);
    let dvrs;
    if (!plexServers[i].arGuide && !plexServers[i].arChannels) {
      continue;
    }
    try {
      dvrs = await plex.GetDVRS(); // Refresh guide and channel mappings
    } catch (err) {
      console.error(
        `Couldn't get DVRS list from ${plexServers[i].name}. This error will prevent 'refresh guide' or 'refresh channels' from working for this Plex server. But it is NOT related to playback issues.`,
        err,
      );
      continue;
    }
    if (plexServers[i].arGuide) {
      try {
        await plex.RefreshGuide(dvrs);
      } catch (err) {
        console.error(
          `Couldn't tell Plex ${plexServers[i].name} to refresh guide for some reason. This error will prevent 'refresh guide' from working for this Plex server. But it is NOT related to playback issues.`,
          err,
        );
      }
    }
    if (plexServers[i].arChannels && channels.length !== 0) {
      try {
        await plex.RefreshChannels(channels, dvrs);
      } catch (err) {
        console.error(
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
  startInterval: () => {
    const ctx = serverContext();
    let xmltvSettings = ctx.db['xmltv-settings'].find()[0];
    if (xmltvSettings.refresh !== 0) {
      xmltvInterval.interval = setInterval(
        async () => {
          try {
            await xmltvInterval.updateXML();
          } catch (err) {
            console.error('update XMLTV error', err);
          }
        },
        xmltvSettings.refresh * 60 * 60 * 1000,
      );
    }
  },
  restartInterval: () => {
    if (xmltvInterval.interval !== null) clearInterval(xmltvInterval.interval);
    xmltvInterval.startInterval();
  },
};
