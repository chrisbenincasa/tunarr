import { isUndefined } from 'lodash-es';
import { ChannelDB } from './channel-db.js';
import { FillerDB } from './filler-db.js';
import { serverOptions } from '../globals.js';

//hmnn this is more of a "PlexServerService"...
const ICON_REGEX =
  /https?:\/\/.*(\/library\/metadata\/\d+\/thumb\/\d+).X-Plex-Token=.*/;

const ICON_FIELDS = ['icon', 'showIcon', 'seasonIcon', 'episodeIcon'];

export class PlexServerDB {
  channelDB: any;
  db: any;
  channelCache: any;
  fillerDB: any;
  showDB: any;
  constructor(
    channelDB: ChannelDB,
    channelCache,
    fillerDB: FillerDB,
    showDB,
    db,
  ) {
    this.channelDB = channelDB;
    this.db = db;
    this.channelCache = channelCache;
    this.fillerDB = fillerDB;
    this.showDB = showDB;
  }

  async fixupAllChannels(name, newServer) {
    let channelNumbers = await this.channelDB.getAllChannelNumbers();
    let report = await Promise.all(
      channelNumbers.map(async (i) => {
        let channel = await this.channelDB.getChannel(i);
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
          if (channel.offlineMode != 'pic') {
            channel.offlineMode = 'pic';
            channel.offlinePicture = `http://localhost:${
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
        await this.channelDB.saveChannel(i, channel);
        return channelReport;
      }),
    );
    this.channelCache.clear();
    return report;
  }

  async fixupAllFillers(name, newServer) {
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

  async fixupAllShows(name, newServer) {
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

  async fixupEveryProgramHolders(serverName, newServer) {
    let reports = await Promise.all([
      this.fixupAllChannels(serverName, newServer),
      this.fixupAllFillers(serverName, newServer),
      this.fixupAllShows(serverName, newServer),
    ]);
    let report = [];
    reports.forEach((r) =>
      r.forEach((r2) => {
        report.push(r2);
      }),
    );
    return report;
  }

  async deleteServer(name) {
    let report = await this.fixupEveryProgramHolders(name, null);
    this.db['plex-servers'].remove({ name: name });
    return report;
  }

  doesNameExist(name) {
    return this.db['plex-servers'].find({ name: name }).length > 0;
  }

  async updateServer(server) {
    let name = server.name;
    if (isUndefined(name)) {
      throw Error('Missing server name from request');
    }
    let s = this.db['plex-servers'].find({ name: name });
    if (s.length != 1) {
      throw Error("Server doesn't exist.");
    }
    s = s[0];
    let arGuide = server.arGuide;
    if (isUndefined(arGuide)) {
      arGuide = false;
    }
    let arChannels = server.arChannels;
    if (isUndefined(arChannels)) {
      arChannels = false;
    }
    let newServer = {
      name: s.name,
      uri: server.uri,
      accessToken: server.accessToken,
      arGuide: arGuide,
      arChannels: arChannels,
      index: s.index,
    };
    this.normalizeServer(newServer);

    let report = await this.fixupEveryProgramHolders(name, newServer);

    this.db['plex-servers'].update({ _id: s._id }, newServer);
    return report;
  }

  async addServer(server) {
    let name = server.name;
    if (isUndefined(name)) {
      name = 'plex';
    }
    let i = 2;
    let prefix = name;
    let resultName = name;
    while (this.doesNameExist(resultName)) {
      resultName = `${prefix}${i}`;
      i += 1;
    }
    name = resultName;
    let arGuide = server.arGuide;
    if (isUndefined(arGuide)) {
      arGuide = false;
    }
    let arChannels = server.arGuide;
    if (isUndefined(arChannels)) {
      arChannels = false;
    }
    let index = this.db['plex-servers'].find({}).length;

    let newServer = {
      name: name,
      uri: server.uri,
      accessToken: server.accessToken,
      arGuide: arGuide,
      arChannels: arChannels,
      index: index,
    };
    this.normalizeServer(newServer);
    this.db['plex-servers'].save(newServer);
  }

  fixupProgramArray(arr, serverName, newServer, channelReport) {
    if (typeof arr !== 'undefined') {
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
  fixupProgram(program, serverName, newServer, channelReport) {
    if (program.serverKey === serverName && newServer == null) {
      channelReport.destroyedPrograms += 1;
      return {
        isOffline: true,
        duration: program.duration,
      };
    } else if (program.serverKey === serverName) {
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

  normalizeServer(server) {
    while (server.uri.endsWith('/')) {
      server.uri = server.uri.slice(0, -1);
    }
  }
}
