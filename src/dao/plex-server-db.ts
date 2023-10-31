import { find, isUndefined } from 'lodash-es';
import { ChannelDB } from './channel-db.js';
import { FillerDB } from './filler-db.js';
import { serverOptions } from '../globals.js';
import { ChannelCache } from '../channel-cache.js';
import { CustomShowDB } from './custom-show-db.js';
import { PlexServerSettings, Program, getDB } from './db.js';
import type { MarkOptional } from 'ts-essentials';

//hmnn this is more of a "PlexServerService"...
const ICON_REGEX =
  /https?:\/\/.*(\/library\/metadata\/\d+\/thumb\/\d+).X-Plex-Token=.*/;

const ICON_FIELDS = ['icon', 'showIcon', 'seasonIcon', 'episodeIcon'];

export class PlexServerDB {
  channelDB: ChannelDB;
  db: any;
  channelCache: ChannelCache;
  fillerDB: FillerDB;
  showDB: CustomShowDB;

  constructor(
    channelDB: ChannelDB,
    channelCache: ChannelCache,
    fillerDB: FillerDB,
    showDB: CustomShowDB,
    db,
  ) {
    this.channelDB = channelDB;
    this.db = db;
    this.channelCache = channelCache;
    this.fillerDB = fillerDB;
    this.showDB = showDB;
  }

  async fixupAllChannels(name: string, newServer?: PlexServerSettings) {
    let channelNumbers = await this.channelDB.getAllChannelNumbers();
    let report = await Promise.all(
      channelNumbers.map(async (i) => {
        let channel = (await this.channelDB.getChannel(i))!;
        let channelReport = {
          channelNumber: channel.number,
          channelName: channel.name,
          destroyedPrograms: 0,
          modifiedPrograms: 0,
        };
        this.fixupProgramArray(
          channel.programs,
          name,
          newServer,
          channelReport,
        );
        //if fallback became offline, remove it
        if (
          typeof channel.fallback !== 'undefined' &&
          channel.fallback.length > 0 &&
          channel.fallback[0].isOffline
        ) {
          channel.fallback = [];
          if (channel.offline.mode != 'pic') {
            channel.offline.mode = 'pic';
            channel.offline.picture = `http://localhost:${
              serverOptions().port
            }/images/generic-offline-screen.png`;
          }
        }
        this.fixupProgramArray(
          channel.fallback,
          name,
          newServer,
          channelReport,
        );
        await this.channelDB.saveChannel(channel);
        return channelReport;
      }),
    );
    this.channelCache.clear();
    return report;
  }

  async fixupAllFillers(name: string, newServer?: PlexServerSettings) {
    let fillers = await this.fillerDB.getAllFillers();
    let report = await Promise.all(
      fillers.map(async (filler) => {
        let fillerReport = {
          channelNumber: '--',
          channelName: filler.name + ' (filler)',
          destroyedPrograms: 0,
          modifiedPrograms: 0,
        };
        this.fixupProgramArray(filler.content, name, newServer, fillerReport);
        filler.content = this.removeOffline(filler.content);

        await this.fillerDB.saveFiller(filler.id, filler);

        return fillerReport;
      }),
    );
    return report;
  }

  async fixupAllShows(name: string, newServer?: PlexServerSettings) {
    let shows = await this.showDB.getAllShows();
    let report = await Promise.all(
      shows.map(async (show) => {
        let showReport = {
          channelNumber: '--',
          channelName: show.name + ' (custom show)',
          destroyedPrograms: 0,
          modifiedPrograms: 0,
        };
        this.fixupProgramArray(show.content, name, newServer, showReport);
        show.content = this.removeOffline(show.content);

        await this.showDB.saveShow(show.id, show);

        return showReport;
      }),
    );
    return report;
  }

  removeOffline(progs) {
    if (isUndefined(progs)) {
      return progs;
    }
    return progs.filter((p) => {
      return true !== p.isOffline;
    });
  }

  async fixupEveryProgramHolders(
    serverName: string,
    newServer?: PlexServerSettings,
  ) {
    let reports = await Promise.all([
      this.fixupAllChannels(serverName, newServer),
      this.fixupAllFillers(serverName, newServer),
      this.fixupAllShows(serverName, newServer),
    ]);
    let report: any[] = [];
    reports.forEach((r) =>
      r.forEach((r2) => {
        report.push(r2);
      }),
    );
    return report;
  }

  async deleteServer(name: string) {
    let report = await this.fixupEveryProgramHolders(name);
    this.db['plex-servers'].remove({ name: name });
    return report;
  }

  async doesNameExist(name: string) {
    return !isUndefined(find((await getDB()).plexServers(), { name }));
  }

  async updateServer(
    server: MarkOptional<
      PlexServerSettings,
      'sendChannelUpdates' | 'sendGuideUpdates' | 'id'
    >,
  ) {
    let name = server.name;
    if (isUndefined(name)) {
      throw Error('Missing server name from request');
    }

    let s = find((await getDB()).plexServers(), { name });

    if (isUndefined(s)) {
      throw Error("Server doesn't exist.");
    }

    const sendGuideUpdates = server.sendGuideUpdates ?? false;
    const sendChannelUpdates = server.sendChannelUpdates ?? false;

    let newServer: PlexServerSettings = {
      ...server,
      name: s.name,
      uri: server.uri,
      accessToken: server.accessToken,
      sendGuideUpdates,
      sendChannelUpdates,
      index: s.index,
    };

    this.normalizeServer(newServer);

    let report = await this.fixupEveryProgramHolders(name, newServer);

    this.db['plex-servers'].update({ id: s.id }, newServer);
    return report;
  }

  async addServer(
    server: MarkOptional<
      PlexServerSettings,
      'sendChannelUpdates' | 'sendGuideUpdates'
    >,
  ) {
    let name = isUndefined(server.name) ? 'plex' : server.name;
    let i = 2;
    let prefix = name;
    let resultName = name;
    while (await this.doesNameExist(resultName)) {
      resultName = `${prefix}${i}`;
      i += 1;
    }
    name = resultName;

    const sendGuideUpdates = server.sendGuideUpdates ?? false;
    const sendChannelUpdates = server.sendChannelUpdates ?? false;

    let index = (await getDB()).plexServers.length;

    let newServer: PlexServerSettings = {
      name: name,
      uri: server.uri,
      accessToken: server.accessToken,
      sendGuideUpdates,
      sendChannelUpdates,
      index: index,
    };
    this.normalizeServer(newServer);
    await getDB();
    this.db['plex-servers'].save(newServer);
  }

  fixupProgramArray(
    arr: Program[],
    serverName: string,
    newServer: PlexServerSettings | undefined,
    channelReport,
  ) {
    if (!isUndefined(arr)) {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = this.fixupProgram(
          arr[i],
          serverName,
          newServer,
          channelReport,
        );
      }
    }
  }

  fixupProgram(
    program,
    serverName: string,
    newServer: PlexServerSettings | undefined,
    channelReport,
  ) {
    if (program.serverKey === serverName && isUndefined(newServer)) {
      channelReport.destroyedPrograms += 1;
      return {
        isOffline: true,
        duration: program.duration,
      };
    } else if (program.serverKey === serverName && !isUndefined(newServer)) {
      let modified = false;
      ICON_FIELDS.forEach((field) => {
        if (
          typeof program[field] === 'string' &&
          program[field].includes('/library/metadata') &&
          program[field].includes('X-Plex-Token')
        ) {
          let m = program[field].match(ICON_REGEX);
          if (m.length == 2) {
            let lib = m[1];
            let newUri = `${newServer.uri}${lib}?X-Plex-Token=${newServer.accessToken}`;
            program[field] = newUri;
            modified = true;
          }
        }
      });
      if (modified) {
        channelReport.modifiedPrograms += 1;
      }
    }
    return program;
  }

  normalizeServer(server: PlexServerSettings) {
    while (server.uri.endsWith('/')) {
      server.uri = server.uri.slice(0, -1);
    }
  }
}
