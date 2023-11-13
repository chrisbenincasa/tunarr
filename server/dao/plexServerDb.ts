import { isUndefined } from 'lodash-es';
import type { DeepReadonly, MarkOptional, Writable } from 'ts-essentials';
import { ChannelCache } from '../channelCache.js';
import { serverOptions } from '../globals.js';
import { ChannelDB } from './channelDb.js';
import { CustomShowDB } from './customShowDb.js';
import {
  Channel,
  DbAccess,
  PlexServerSettings,
  Program,
  offlineProgram,
} from './db.js';
import { FillerDB } from './fillerDb.js';

//hmnn this is more of a "PlexServerService"...
const ICON_REGEX =
  /https?:\/\/.*(\/library\/metadata\/\d+\/thumb\/\d+).X-Plex-Token=.*/;

type Report = {
  channelNumber: number;
  channelName: string;
  destroyedPrograms: number;
  modifiedPrograms: number;
};

export type PlexServerSettingsInsert = MarkOptional<
  PlexServerSettings,
  'sendChannelUpdates' | 'sendGuideUpdates'
>;

export type PlexServerSettingsUpdate = MarkOptional<
  PlexServerSettings,
  'sendChannelUpdates' | 'sendGuideUpdates' | 'id'
>;

export class PlexServerDB {
  private channelDB: ChannelDB;
  private channelCache: ChannelCache;
  private fillerDB: FillerDB;
  private showDB: CustomShowDB;
  private dbAccess: DbAccess;

  constructor(
    channelDB: ChannelDB,
    channelCache: ChannelCache,
    fillerDB: FillerDB,
    showDB: CustomShowDB,
    dbAccess: DbAccess,
  ) {
    this.channelDB = channelDB;
    this.channelCache = channelCache;
    this.fillerDB = fillerDB;
    this.showDB = showDB;
    this.dbAccess = dbAccess;
  }

  async fixupAllChannels(name: string, newServer?: PlexServerSettings) {
    const channelNumbers = this.channelDB.getAllChannelNumbers();
    const report = await Promise.all(
      channelNumbers.map(async (i) => {
        const channel = this.channelDB.getChannel(i)!;

        const channelReport: Report = {
          channelNumber: channel.number,
          channelName: channel.name,
          destroyedPrograms: 0,
          modifiedPrograms: 0,
        };

        const newPrograms = this.fixupProgramArray(
          channel.programs,
          name,
          newServer,
          channelReport,
        );

        const newChannel: Channel = {
          ...(channel as Writable<Channel>),
          programs: newPrograms,
        };

        if (
          !isUndefined(channel.fallback) &&
          channel.fallback.length > 0 &&
          channel.fallback[0].isOffline
        ) {
          newChannel.fallback = [];
          if (channel.offline.mode != 'pic') {
            newChannel.offline.mode = 'pic';
            newChannel.offline.picture = `http://localhost:${
              serverOptions().port
            }/images/generic-offline-screen.png`;
          }
        }
        newChannel.fallback = this.fixupProgramArray(
          channel.fallback,
          name,
          newServer,
          channelReport,
        );

        await this.channelDB.saveChannel(newChannel);

        return channelReport;
      }),
    );

    this.channelCache.clear();

    return report;
  }

  async fixupAllFillers(name: string, newServer?: PlexServerSettings) {
    const fillers = this.fillerDB.getAllFillers();
    const report = await Promise.all(
      fillers.map(async (filler) => {
        const fillerReport: Report = {
          channelNumber: -1,
          channelName: filler.name + ' (filler)',
          destroyedPrograms: 0,
          modifiedPrograms: 0,
        };

        const newFiller = {
          ...filler,
          content: this.removeOffline(
            this.fixupProgramArray(
              filler.content,
              name,
              newServer,
              fillerReport,
            ),
          ),
        };

        await this.fillerDB.saveFiller(filler.id, newFiller);

        return fillerReport;
      }),
    );
    return report;
  }

  async fixupAllShows(name: string, newServer?: PlexServerSettings) {
    const shows = this.showDB.getAllShows();
    const report = await Promise.all(
      shows.map(async (show) => {
        const showReport: Report = {
          channelNumber: -1,
          channelName: show.name + ' (custom show)',
          destroyedPrograms: 0,
          modifiedPrograms: 0,
        };

        const newShow = {
          ...show,
          content: this.removeOffline(
            this.fixupProgramArray(show.content, name, newServer, showReport),
          ),
        };

        await this.showDB.saveShow(show.id, newShow);

        return showReport;
      }),
    );
    return report;
  }

  removeOffline(progs: Program[]) {
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
    const reports = await Promise.all([
      this.fixupAllChannels(serverName, newServer),
      this.fixupAllFillers(serverName, newServer),
      this.fixupAllShows(serverName, newServer),
    ]);
    const report: Report[] = [];
    reports.forEach((r) =>
      r.forEach((r2) => {
        report.push(r2);
      }),
    );
    return report;
  }

  async deleteServer(name: string) {
    const report = await this.fixupEveryProgramHolders(name);
    await this.dbAccess.plexServers().delete(name);
    return report;
  }

  doesNameExist(name: string) {
    return !isUndefined(this.dbAccess.plexServers().getById(name));
  }

  async updateServer(server: PlexServerSettingsUpdate) {
    const name = server.name;
    if (isUndefined(name)) {
      throw Error('Missing server name from request');
    }

    const s = this.dbAccess.plexServers().getById(name);

    if (isUndefined(s)) {
      throw Error("Server doesn't exist.");
    }

    const sendGuideUpdates = server.sendGuideUpdates ?? false;
    const sendChannelUpdates = server.sendChannelUpdates ?? false;

    const newServer: PlexServerSettings = {
      ...server,
      name: s.name,
      uri: server.uri,
      accessToken: server.accessToken,
      sendGuideUpdates,
      sendChannelUpdates,
      index: s.index,
    };

    this.normalizeServer(newServer);

    const report = await this.fixupEveryProgramHolders(name, newServer);

    await this.dbAccess
      .plexServers()
      .insertOrUpdate({ ...newServer, id: s.id });
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
    const prefix = name;
    let resultName = name;
    while (this.doesNameExist(resultName)) {
      resultName = `${prefix}${i}`;
      i += 1;
    }
    name = resultName;

    const sendGuideUpdates = server.sendGuideUpdates ?? false;
    const sendChannelUpdates = server.sendChannelUpdates ?? false;

    const index = this.dbAccess.plexServers().getAll().length;

    const newServer: PlexServerSettings = {
      name: name,
      uri: server.uri,
      accessToken: server.accessToken,
      sendGuideUpdates,
      sendChannelUpdates,
      index: index,
    };
    this.normalizeServer(newServer);

    return this.dbAccess.plexServers().insertOrUpdate(newServer);
  }

  fixupProgramArray(
    arr: DeepReadonly<Program[]>,
    serverName: string,
    newServer: PlexServerSettings | undefined,
    channelReport: Report,
  ) {
    if (isUndefined(arr)) {
      return [];
    }

    return arr.map((program) => {
      return this.fixupProgram(program, serverName, newServer, channelReport);
    });
  }

  fixupProgram(
    program: DeepReadonly<Program>,
    serverName: string,
    newServer: PlexServerSettings | undefined,
    channelReport: Report,
  ): Program {
    if (program.serverKey === serverName && isUndefined(newServer)) {
      channelReport.destroyedPrograms += 1;
      return offlineProgram(program.duration);
    } else if (program.serverKey === serverName && !isUndefined(newServer)) {
      let modified = false;
      const fixIcon = (icon: string | undefined) => {
        if (
          !isUndefined(icon) &&
          icon.includes('/library/metadata') &&
          icon.includes('X-Plex-Token')
        ) {
          const m = icon.match(ICON_REGEX);
          if (m?.length == 2) {
            const lib = m[1];
            const newUri = `${newServer.uri}${lib}?X-Plex-Token=${newServer.accessToken}`;
            modified = true;
            return newUri;
          }
        }
        return icon;
      };

      const newProgram: Program = {
        ...program,
        icon: fixIcon(program.icon) as string, // This will always be defined
        showIcon: fixIcon(program.showIcon),
        episodeIcon: fixIcon(program.episodeIcon),
        seasonIcon: fixIcon(program.seasonIcon),
      };

      if (modified) {
        channelReport.modifiedPrograms += 1;
      }

      return newProgram;
    }

    return program;
  }

  normalizeServer(server: PlexServerSettings) {
    while (server.uri.endsWith('/')) {
      server.uri = server.uri.slice(0, -1);
    }
  }
}
