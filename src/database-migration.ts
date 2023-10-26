/**
 * Setting up channels is a lot of work. Same goes for configuration.
 * Also, it's always healthy to be releasing versions frequently and have people
 * test them frequently. But if losing data after upgrades is a common ocurrence
 * then users will just not want to give new versions a try. That's why
 * starting with version 0.0.54 and forward we don't want users to be losing
 * data just because they upgraded their channels. In order to accomplish that
 * we need some work put into the db structure so that it is capable of
 * being updated.
 *
 * Even if we reached a point like in 0.0.53 where the old channels have to
 * be completely deleted and can't be recovered. Then that's what the migration
 * should do. Remove the information that can't be recovered and notify the
 * user about it.
 *
 * A lot of this will look like overkill during the first versions it's used
 * but with time it will be worth it, really.
 *
 ***/
const path = require('path');
var fs = require('fs');

const TARGET_VERSION = 803;

const STEPS: [number, number, (db, channels, dir) => any][] = [
  // [v, v2, x] : if the current version is v, call x(db), and version becomes v2
  [0, 100, (db) => basicDB(db)],
  [100, 200, (db) => commercialsRemover(db)],
  [200, 300, (db) => appNameChange(db)],
  [300, 400, (db) => createDeviceId(db)],
  [400, 500, (db, channels) => splitServersSingleChannels(db, channels)],
  [500, 501, (db) => fixCorruptedServer(db)],
  [501, 600, () => extractFillersFromChannels()],
  [600, 601, (db) => addFPS(db)],
  [601, 700, (db) => migrateWatermark(db)],
  [700, 701, (db) => addScalingAlgorithm(db)],
  [701, 703, (_db, _channels, dir) => reAddIcon(dir)],
  [703, 800, (db) => addDeinterlaceFilter(db)],
  // there was a bit of thing in which for a while 1.3.x migrated 701 to 702 using
  // the addDeinterlaceFilter step. This 702 step no longer exists as a target
  // but we have to migrate it to 800 using the reAddIcon.
  [702, 800, (_db, _channels, dir) => reAddIcon(dir)],
  [800, 801, (db) => addImageCache(db)],
  [801, 802, () => addGroupTitle()],
  [802, 803, () => fixNonIntegerDurations()],
];

const { v4: uuidv4 } = require('uuid');

function createDeviceId(db) {
  let deviceId = db['client-id'].find();
  if (deviceId.length == 0) {
    let clientId =
      uuidv4().replace(/-/g, '').slice(0, 16) +
      '-org-dizquetv-' +
      process.platform;
    let dev = {
      clientId: clientId,
    };
    db['client-id'].save(dev);
  }
}

function appNameChange(db) {
  let xmltv = db['xmltv-settings'].find();
  if (xmltv.length > 0) {
    xmltv = xmltv[0];
    if (typeof xmltv.file !== 'undefined') {
      xmltv.file = xmltv.file.replace(/\.pseudotv/, '.dizquetv');
      db['xmltv-settings'].update({ _id: xmltv._id }, xmltv);
    }
  }
}

function basicDB(db) {
  //this one should either try recovering the db from a very old version
  //or buildl a completely empty db at version 0
  let ffmpegSettings = db['ffmpeg-settings'].find();
  let plexSettings = db['plex-settings'].find();

  var ffmpegRepaired = repairFFmpeg0(ffmpegSettings);
  if (ffmpegRepaired.hasBeenRepaired) {
    var fixed = ffmpegRepaired.fixedConfig;
    var i = fixed._id;
    if (i == null || typeof i == 'undefined') {
      db['ffmpeg-settings'].save(fixed);
    } else {
      db['ffmpeg-settings'].update({ _id: i }, fixed);
    }
  }

  if (plexSettings.length === 0) {
    db['plex-settings'].save({
      streamPath: 'plex',
      debugLogging: true,
      directStreamBitrate: '20000',
      transcodeBitrate: '2000',
      mediaBufferSize: 1000,
      transcodeMediaBufferSize: 20000,
      maxPlayableResolution: '1920x1080',
      maxTranscodeResolution: '1920x1080',
      videoCodecs: 'h264,hevc,mpeg2video',
      audioCodecs: 'ac3,aac',
      maxAudioChannels: '2',
      audioBoost: '100',
      enableSubtitles: false,
      subtitleSize: '100',
      updatePlayStatus: false,
      streamProtocol: 'http',
      forceDirectPlay: false,
      pathReplace: '',
      pathReplaceWith: '',
    });
  }
  let plexServers = db['plex-servers'].find();
  //plex servers exist, but they could be old
  let newPlexServers = {};
  for (let i = 0; i < plexServers.length; i++) {
    let plex = plexServers[i];
    if (
      typeof plex.connections === 'undefined' ||
      plex.connections.length == 0
    ) {
      let newPlex = attemptMigratePlexFrom51(plex);
      newPlexServers[plex.name] = newPlex;
      db['plex-servers'].update({ _id: plex._id }, newPlex);
    }
  }
  if (Object.keys(newPlexServers).length !== 0) {
    migrateChannelsFrom51(db, newPlexServers);
  }

  let xmltvSettings = db['xmltv-settings'].find();
  if (xmltvSettings.length === 0) {
    db['xmltv-settings'].save({
      cache: 12,
      refresh: 4,
      file: `${process.env.DATABASE}/xmltv.xml`,
    });
  }
  let hdhrSettings = db['hdhr-settings'].find();
  if (hdhrSettings.length === 0) {
    db['hdhr-settings'].save({
      tunerCount: 2,
      autoDiscovery: true,
    });
  }
}

function migrateChannelsFrom51(db, newPlexServers) {
  console.log(
    'Attempting to migrate channels from old format. This may take a while...',
  );
  let channels = db['channels'].find();
  function fix(program) {
    if (typeof program.plexFile === 'undefined') {
      let file = program.file;
      program.plexFile = file.slice(program.server.uri.length);
      let i = 0;
      while (i < program.plexFile.length && program.plexFile.charAt(i) != '?') {
        i++;
      }
      program.plexFile = program.plexFile.slice(0, i);
      delete program.file;
    }
  }
  for (let i = 0; i < channels.length; i++) {
    let channel = channels[i];
    let programs = channel.programs;
    let newPrograms = [];
    for (let j = 0; j < programs.length; j++) {
      let program = programs[j];
      if (
        typeof program.server === 'undefined' ||
        typeof program.server.name === 'undefined' ||
        (typeof program.plexFile === 'undefined' &&
          typeof program.file === 'undefined')
      ) {
        let duration = program.duration;
        if (typeof duration !== 'undefined') {
          console.log(
            `A program in channel ${channel.number} doesn't have server/plex file information. Replacing it with Flex time`,
          );
          program = {
            isOffline: true,
            actualDuration: duration,
            duration: duration,
          };
          newPrograms.push(program);
        } else {
          console.log(
            `A program in channel ${channel.number} is completely invalid and has been removed.`,
          );
        }
      } else {
        if (typeof newPlexServers[program.server.name] !== 'undefined') {
          program.server = newPlexServers[program.server.name];
        } else {
          console.log(
            "turns out '" +
              program.server.name +
              "' is not in " +
              JSON.stringify(newPlexServers),
          );
        }
        let commercials = program.commercials;
        fix(program);
        if (typeof commercials === 'undefined' || commercials.length == 0) {
          commercials = [];
        }
        let newCommercials = [];
        for (let k = 0; k < commercials.length; k++) {
          let commercial = commercials[k];
          if (
            typeof commercial.server === 'undefined' ||
            typeof commercial.server.name === 'undefined' ||
            (typeof commercial.plexFile === 'undefined' &&
              typeof commercial.file === 'undefined')
          ) {
            console.log(
              `A commercial in channel ${channel.number} has invalid server/plex file information and has been removed.`,
            );
          } else {
            if (typeof newPlexServers[commercial.server.name] !== 'undefined') {
              commercial.server = newPlexServers[commercial.server.name];
            }
            fix(commercial);

            newCommercials.push(commercial);
          }
        }
        program.commercials = newCommercials;
        newPrograms.push(program);
      }
    }
    channel.programs = newPrograms;
    db.channels.update({ number: channel.number }, channel);
  }
}

function attemptMigratePlexFrom51(plex) {
  console.log(
    'Attempting to migrate existing Plex server: ' + plex.name + '...',
  );
  let u = 'unknown(migrated from 0.0.51)';
  //most of the new variables aren't really necessary so it doesn't matter
  //to replace them with placeholders
  let uri = plex.protocol + '://' + plex.host + ':' + plex.port;
  let newPlex = {
    name: plex.name,
    product: 'Plex Media Server',
    productVersion: u,
    platform: u,
    platformVersion: u,
    device: u,
    clientIdentifier: u,
    createdAt: u,
    lastSeenAt: u,
    provides: 'server',
    ownerId: null,
    sourceTitle: null,
    publicAddress: plex.host,
    accessToken: plex.token,
    owned: true,
    home: false,
    synced: false,
    relay: true,
    presence: true,
    httpsRequired: true,
    publicAddressMatches: true,
    dnsRebindingProtection: false,
    natLoopbackSupported: false,
    connections: [
      {
        protocol: plex.protocol,
        address: plex.host,
        port: plex.port,
        uri: uri,
        local: true,
        relay: false,
        IPv6: false,
      },
    ],
    uri: uri,
    protocol: plex.protocol,
    address: plex.host,
    port: plex.host,
    arGuide: plex.arGuide,
    arChannels: plex.arChannels,
    _id: plex._id,
  };
  console.log('Sucessfully migrated plex server: ' + plex.name);
  return newPlex;
}

function commercialsRemover(db) {
  let getKey = (program) => {
    let key = program.key;
    return typeof key === 'undefined' ? '?' : key;
  };

  let channels = db['channels'].find();
  for (let i = 0; i < channels.length; i++) {
    let channel = channels[i];
    let fixedPrograms = [];
    let fixedFiller = channel.fillerContent;
    if (typeof fixedFiller === 'undefined') {
      fixedFiller = [];
    }
    let addedFlex = false;
    let seenPrograms = {};
    for (let i = 0; i < fixedFiller.length; i++) {
      seenPrograms[getKey(fixedFiller[i])] = true;
    }
    for (let j = 0; j < channel.programs.length; j++) {
      let fixedProgram = channel.programs[j];
      let commercials = fixedProgram.commercials;
      if (typeof commercials == 'undefined') {
        commercials = [];
      }
      delete fixedProgram.commercials;
      for (let k = 0; k < commercials.length; k++) {
        if (typeof seenPrograms[getKey(commercials[k])] === 'undefined') {
          seenPrograms[getKey(commercials[k])] = true;
          fixedFiller.push(commercials[k]);
        }
      }
      let diff = fixedProgram.duration - fixedProgram.actualDuration;
      fixedProgram.duration = fixedProgram.actualDuration;
      fixedPrograms.push(fixedProgram);
      if (diff > 0) {
        addedFlex = true;
        fixedPrograms.push({
          isOffline: true,
          duration: diff,
          actualDuration: diff,
        });
      }
    }
    channel.programs = fixedPrograms;
    channel.fillerContent = fixedFiller;
    //TODO: maybe remove duplicates?
    if (addedFlex) {
      //fill up some flex settings just in case
      if (typeof channel.fillerRepeatCooldown === 'undefined') {
        channel.fillerRepeatCooldown = 10 * 60 * 1000;
      }
      if (typeof channel.offlineMode === 'undefined') {
        console.log(
          'Added provisional fallback to channel #' +
            channel.number +
            ' ' +
            channel.name +
            ' . You might want to tweak this value in channel configuration.',
        );
        channel.offlineMode = 'pic';
        channel.fallback = [];
        channel.offlinePicture = `http://localhost:${process.env.PORT}/images/generic-offline-screen.png`;
        channel.offlineSoundtrack = '';
      }
      if (typeof channel.disableFillerOverlay === 'undefined') {
        channel.disableFillerOverlay = true;
      }
    }
    db.channels.update({ number: channel.number }, channel);
  }
}

export function initDB(db, channelDB, dir) {
  if (typeof channelDB === 'undefined') {
    throw Error('???');
  }
  let dbVersion = db['db-version'].find()[0];
  if (typeof dbVersion === 'undefined') {
    dbVersion = { version: 0 };
  }
  while (dbVersion.version != TARGET_VERSION) {
    let ran = false;
    for (let i = 0; i < STEPS.length; i++) {
      if (STEPS[i][0] == dbVersion.version) {
        ran = true;
        console.log(
          'Migrating from db version ' +
            dbVersion.version +
            ' to: ' +
            STEPS[i][1] +
            '...',
        );
        try {
          STEPS[i][2](db, channelDB, dir);
          if (typeof dbVersion._id === 'undefined') {
            db['db-version'].save({ version: STEPS[i][1] });
          } else {
            db['db-version'].update(
              { _id: dbVersion._id },
              { version: STEPS[i][1] },
            );
          }
          dbVersion = db['db-version'].find()[0];
          console.log('Done migrating db to version : ' + dbVersion.version);
        } catch (e) {
          console.log(
            "Error during migration. Sorry, we can't continue. Wiping out your .dizquetv folder might be a workaround, but that means you lose all your settings.",
            e,
          );
          throw Error('Migration error, step=' + dbVersion.version);
        }
      }
    }
    if (!ran) {
      throw Error(
        'Unable to find migration step from version: ' + dbVersion.version,
      );
    }
  }
  console.log(`DB Version correct: ${dbVersion.version}`);
}

export function ffmpeg() {
  return {
    //How default ffmpeg settings should look
    configVersion: 5,
    ffmpegPath: '/usr/bin/ffmpeg',
    threads: 4,
    concatMuxDelay: '0',
    logFfmpeg: false,
    enableFFMPEGTranscoding: true,
    audioVolumePercent: 100,
    videoEncoder: 'mpeg2video',
    audioEncoder: 'ac3',
    targetResolution: '1920x1080',
    videoBitrate: 2000,
    videoBufSize: 2000,
    audioBitrate: 192,
    audioBufSize: 50,
    audioSampleRate: 48,
    audioChannels: 2,
    errorScreen: 'pic',
    errorAudio: 'silent',
    normalizeVideoCodec: true,
    normalizeAudioCodec: true,
    normalizeResolution: true,
    normalizeAudio: true,
    maxFPS: 60,
    scalingAlgorithm: 'bicubic',
    deinterlaceFilter: 'none',
  };
}

//This initializes ffmpeg config for db version 0
//there used to be a concept of configVersion which worked like this database
//migration thing but only for settings. Nowadays that sort of migration should
//be done at a db-version level.
function repairFFmpeg0(existingConfigs) {
  var hasBeenRepaired = false;
  var currentConfig: Record<string, any> = {};
  var _id = null;
  if (existingConfigs.length === 0) {
    currentConfig = {};
  } else {
    currentConfig = existingConfigs[0];
    _id = currentConfig._id;
  }
  if (
    typeof currentConfig.configVersion === 'undefined' ||
    currentConfig.configVersion < 3
  ) {
    hasBeenRepaired = true;
    currentConfig = ffmpeg();
    currentConfig._id = _id;
  }
  if (currentConfig.configVersion == 3) {
    //migrate from version 3 to 4
    hasBeenRepaired = true;
    //new settings:
    currentConfig.audioBitrate = 192;
    currentConfig.audioBufSize = 50;
    currentConfig.audioChannels = 2;
    currentConfig.audioSampleRate = 48;
    //this one has been renamed:
    currentConfig.normalizeAudio = currentConfig.alignAudio;
    currentConfig.configVersion = 4;
  }
  if (currentConfig.configVersion == 4) {
    //migrate from version 4 to 5
    hasBeenRepaired = true;
    //new settings:
    currentConfig.enableFFMPEGTranscoding = true;
    currentConfig.normalizeVideoCodec = true;
    currentConfig.normalizeAudioCodec = true;
    currentConfig.normalizeResolution = true;
    currentConfig.normalizeAudio = true;

    currentConfig.configVersion = 5;
  }
  return {
    hasBeenRepaired: hasBeenRepaired,
    fixedConfig: currentConfig,
  };
}

function splitServersSingleChannels(db, channelDB) {
  console.log(
    'Migrating channels and plex servers so that plex servers are no longer embedded in program data',
  );
  let servers = db['plex-servers'].find();
  let serverCache = {};
  let serverNames = {};
  let newServers = [];

  let getServerKey = (uri, accessToken) => {
    return uri + '|' + accessToken;
  };

  let getNewName = (name) => {
    if (
      typeof name === 'undefined' ||
      typeof serverNames[name] !== 'undefined'
    ) {
      //recurse because what if some genius actually named their server plex#3 ?
      name = getNewName('plex#' + (Object.keys(serverNames).length + 1));
    }
    serverNames[name] = true;
    return name;
  };

  let saveServer = (name, uri, accessToken, arGuide, arChannels) => {
    if (typeof arGuide === 'undefined') {
      arGuide = false;
    }
    if (typeof arChannels === 'undefined') {
      arChannels = false;
    }
    if (uri.endsWith('/')) {
      uri = uri.slice(0, -1);
    }
    let key = getServerKey(uri, accessToken);
    if (typeof serverCache[key] === 'undefined') {
      serverCache[key] = getNewName(name);
      console.log(
        `for key=${key} found server with name=${serverCache[key]}, uri=${uri}, accessToken=${accessToken}`,
      );
      newServers.push({
        name: serverCache[key],
        uri: uri,
        accessToken: accessToken,
        index: newServers.length,
        arChannels: arChannels,
        arGuide: arGuide,
      });
    }
    return serverCache[key];
  };
  for (let i = 0; i < servers.length; i++) {
    let server = servers[i];
    saveServer(
      server.name,
      server.uri,
      server.accessToken,
      server.arGuide,
      server.arChannels,
    );
  }

  let cleanupProgram = (program) => {
    delete program.actualDuration;
    delete program.commercials;
    delete program.durationStr;
    delete program.start;
    delete program.stop;
    delete program.streams;
    delete program.opts;
  };

  let fixProgram = (program) => {
    //Also remove the "actualDuration" and "commercials" fields.
    try {
      cleanupProgram(program);
      if (program.isOffline) {
        return program;
      }
      let newProgram = JSON.parse(JSON.stringify(program));
      let s = newProgram.server;
      delete newProgram.server;
      let name = saveServer(
        undefined,
        s.uri,
        s.accessToken,
        undefined,
        undefined,
      );
      if (typeof name === 'undefined') {
        throw Error('Unable to find server name');
      }
      //console.log(newProgram.title + " : " + name);
      newProgram.serverKey = name;
      return newProgram;
    } catch (err) {
      console.error('Unable to migrate program. Replacing it with flex');
      return {
        isOffline: true,
        duration: program.duration,
      };
    }
  };

  let fixChannel = (channel) => {
    console.log('Migrating channel: ' + channel.name + ' ' + channel.number);
    for (let i = 0; i < channel.programs.length; i++) {
      channel.programs[i] = fixProgram(channel.programs[i]);
    }
    //if (channel.programs.length > 10) {
    //channel.programs = channel.programs.slice(0, 10);
    //}
    channel.duration = 0;
    for (let i = 0; i < channel.programs.length; i++) {
      channel.duration += channel.programs[i].duration;
    }
    if (typeof channel.fallback === 'undefined') {
      channel.fallback = [];
    }
    for (let i = 0; i < channel.fallback.length; i++) {
      channel.fallback[i] = fixProgram(channel.fallback[i]);
    }
    if (typeof channel.fillerContent === 'undefined') {
      channel.fillerContent = [];
    }
    for (let i = 0; i < channel.fillerContent.length; i++) {
      channel.fillerContent[i] = fixProgram(channel.fillerContent[i]);
    }
    return channel;
  };

  let channels = db['channels'].find();
  for (let i = 0; i < channels.length; i++) {
    channels[i] = fixChannel(channels[i]);
  }

  console.log(
    'Done migrating channels for this step. Saving updates to storage...',
  );

  //wipe out servers
  for (let i = 0; i < servers.length; i++) {
    db['plex-servers'].remove({ _id: servers[i]._id });
  }
  //wipe out old channels
  db['channels'].remove();
  // insert all over again
  if (newServers.length > 0) {
    db['plex-servers'].save(newServers);
  }
  for (let i = 0; i < channels.length; i++) {
    channelDB.saveChannelSync(channels[i].number, channels[i]);
  }
  console.log('Done migrating channels for this step...');
}

function fixCorruptedServer(db) {
  let arr = db['plex-servers'].find();
  let servers = [];
  let badFound = false;
  for (let i = 0; i < arr.length; i++) {
    let server = arr[i];
    if (typeof server.name === 'undefined' && server.length == 0) {
      badFound = true;
      console.log(
        "Found a corrupted plex server. And that's why 63 is a bad version. BAD",
      );
    } else {
      servers.push(server);
    }
  }
  if (badFound) {
    console.log('Fixing the plex-server.json...');
    let f = path.join(process.env.DATABASE, `plex-servers.json`);
    fs.writeFileSync(f, JSON.stringify(servers));
  }
}

function extractFillersFromChannels() {
  console.log('Extracting fillers from channels...');
  let channels = path.join(process.env.DATABASE, 'channels');
  let fillers = path.join(process.env.DATABASE, 'filler');
  let channelFiles = fs.readdirSync(channels);
  let usedNames = {};

  let getName = (channelName) => {
    let i = -1;
    let x = channelName;
    while (typeof usedNames[x] !== 'undefined') {
      x = channelName + ++i;
    }
    return x;
  };

  let saveFiller = (arr, channelName) => {
    let id = uuidv4();
    let name = getName(`Filler - ${channelName}`);
    usedNames[name] = true;
    let fillerPath = path.join(fillers, id + '.json');
    let filler = {
      name: name,
      content: arr,
    };
    fs.writeFileSync(fillerPath, JSON.stringify(filler), 'utf-8');
    return id;
  };

  for (let i = 0; i < channelFiles.length; i++) {
    if (path.extname(channelFiles[i]) === '.json') {
      console.log('Migrating filler in channel : ' + channelFiles[i] + '...');
      let channelPath = path.join(channels, channelFiles[i]);
      let channel = JSON.parse(fs.readFileSync(channelPath, 'utf-8'));
      let fillerId = null;
      if (
        typeof channel.fillerContent !== 'undefined' &&
        channel.fillerContent.length != 0
      ) {
        fillerId = saveFiller(channel.fillerContent, channel.name);
      }
      delete channel.fillerContent;
      if (fillerId != null) {
        channel.fillerCollections = [
          {
            id: fillerId,
            weight: 600,
            cooldown: 0,
          },
        ];
      } else {
        channel.fillerCollections = [];
      }
      fs.writeFileSync(channelPath, JSON.stringify(channel), 'utf-8');
    }
  }
  console.log('Done extracting fillers from channels.');
}

function addFPS(db) {
  let ffmpegSettings = db['ffmpeg-settings'].find()[0];
  let f = path.join(process.env.DATABASE, 'ffmpeg-settings.json');
  ffmpegSettings.maxFPS = 60;
  fs.writeFileSync(f, JSON.stringify([ffmpegSettings]));
}

function migrateWatermark(db) {
  let ffmpegSettings = db['ffmpeg-settings'].find()[0];
  let w = 1920;
  let h = 1080;

  function parseResolutionString(s) {
    var i = s.indexOf('x');
    if (i == -1) {
      i = s.indexOf('×');
      if (i == -1) {
        return { w: 1920, h: 1080 };
      }
    }
    return {
      w: parseInt(s.substring(0, i), 10),
      h: parseInt(s.substring(i + 1), 10),
    };
  }

  if (
    ffmpegSettings.targetResolution != null &&
    typeof ffmpegSettings.targetResolution !== 'undefined'
  ) {
    let p = parseResolutionString(ffmpegSettings.targetResolution);
    w = p.w;
    h = p.h;
  }
  console.log(
    `Using ${w}x${h} as resolution to migrate new watermark settings.`,
  );
  function migrateChannel(channel) {
    if (channel.overlayIcon === true) {
      channel.watermark = {
        enabled: true,
        width: Math.max(0.001, Math.min(100, (channel.iconWidth * 100) / w)),
        verticalMargin: Math.max(0.0, Math.min(100, 2000 / h)),
        horizontalMargin: Math.max(0.0, Math.min(100, 2000 / w)),
        duration: channel.iconDuration,
        fixedSize: false,
        position: ['top-left', 'top-right', 'bottom-left', 'bottom-right'][
          channel.iconPosition
        ],
        url: '', //same as channel icon
        animated: false,
      };
    } else {
      channel.watermark = {
        enabled: false,
      };
    }
    delete channel.overlayIcon;
    delete channel.iconDuration;
    delete channel.iconPosition;
    delete channel.iconWidth;
    return channel;
  }

  console.log('Migrating watermarks...');
  let channels = path.join(process.env.DATABASE, 'channels');
  let channelFiles = fs.readdirSync(channels);
  for (let i = 0; i < channelFiles.length; i++) {
    if (path.extname(channelFiles[i]) === '.json') {
      console.log(
        'Migrating watermark in channel : ' + channelFiles[i] + '...',
      );
      let channelPath = path.join(channels, channelFiles[i]);
      let channel = JSON.parse(fs.readFileSync(channelPath, 'utf-8'));
      channel = migrateChannel(channel);
      fs.writeFileSync(channelPath, JSON.stringify(channel), 'utf-8');
    }
  }
  console.log('Done migrating watermarks in channels.');
}

function addScalingAlgorithm(db) {
  let ffmpegSettings = db['ffmpeg-settings'].find()[0];
  let f = path.join(process.env.DATABASE, 'ffmpeg-settings.json');
  ffmpegSettings.scalingAlgorithm = 'bicubic';
  fs.writeFileSync(f, JSON.stringify([ffmpegSettings]));
}

function moveBackup(path) {
  if (fs.existsSync(`${process.env.DATABASE}${path}`)) {
    let i = 0;
    while (fs.existsSync(`${process.env.DATABASE}${path}.bak.${i}`)) {
      i++;
    }
    fs.renameSync(
      `${process.env.DATABASE}${path}`,
      `${process.env.DATABASE}${path}.bak.${i}`,
    );
  }
}

function reAddIcon(dir) {
  moveBackup('/images/dizquetv.png');
  let data = fs.readFileSync(
    path.resolve(path.join(dir, 'resources/dizquetv.png')),
  );
  fs.writeFileSync(process.env.DATABASE + '/images/dizquetv.png', data);

  if (fs.existsSync(`${process.env.DATABASE}/images/pseudotv.png`)) {
    moveBackup('/images/pseudotv.png');
    let data = fs.readFileSync(
      path.resolve(path.join(dir, 'resources/dizquetv.png')),
    );
    fs.writeFileSync(process.env.DATABASE + '/images/pseudotv.png', data);
  }

  moveBackup('/images/generic-error-screen.png');
  data = fs.readFileSync(
    path.resolve(path.join(dir, 'resources/generic-error-screen.png')),
  );
  fs.writeFileSync(
    process.env.DATABASE + '/images/generic-error-screen.png',
    data,
  );

  moveBackup('/images/generic-offline-screen.png');
  data = fs.readFileSync(
    path.resolve(path.join(dir, 'resources/generic-offline-screen.png')),
  );
  fs.writeFileSync(
    process.env.DATABASE + '/images/generic-offline-screen.png',
    data,
  );

  moveBackup('/images/loading-screen.png');
  data = fs.readFileSync(
    path.resolve(path.join(dir, 'resources/loading-screen.png')),
  );
  fs.writeFileSync(process.env.DATABASE + '/images/loading-screen.png', data);
}

function addDeinterlaceFilter(db) {
  let ffmpegSettings = db['ffmpeg-settings'].find()[0];
  let f = path.join(process.env.DATABASE, 'ffmpeg-settings.json');
  ffmpegSettings.deinterlaceFilter = 'none';
  fs.writeFileSync(f, JSON.stringify([ffmpegSettings]));
}

function addImageCache(db) {
  let xmltvSettings = db['xmltv-settings'].find()[0];
  let f = path.join(process.env.DATABASE, 'xmltv-settings.json');
  xmltvSettings.enableImageCache = false;
  fs.writeFileSync(f, JSON.stringify([xmltvSettings]));
}

function addGroupTitle() {
  function migrateChannel(channel) {
    channel.groupTitle = 'dizqueTV';
    return channel;
  }

  console.log('Adding group title to channels...');
  let channels = path.join(process.env.DATABASE, 'channels');
  let channelFiles = fs.readdirSync(channels);
  for (let i = 0; i < channelFiles.length; i++) {
    if (path.extname(channelFiles[i]) === '.json') {
      console.log('Adding group title to channel : ' + channelFiles[i] + '...');
      let channelPath = path.join(channels, channelFiles[i]);
      let channel = JSON.parse(fs.readFileSync(channelPath, 'utf-8'));
      channel = migrateChannel(channel);
      fs.writeFileSync(channelPath, JSON.stringify(channel), 'utf-8');
    }
  }
  console.log('Done migrating group titles in channels.');
}

function fixNonIntegerDurations() {
  function migrateChannel(channel) {
    let programs = channel.programs;
    let fixedCount = 0;
    channel.duration = 0;
    for (let i = 0; i < programs.length; i++) {
      let program = programs[i];
      if (!Number.isInteger(program.duration)) {
        fixedCount++;
        program.duration = Math.ceil(program.duration);
        programs[i] = program;
      }
      channel.duration += program.duration;
    }
    if (fixedCount != 0) {
      console.log(
        `Found ${fixedCount} non-integer durations in channel ${channel.number}, they were fixed but you should consider running random slots again so that the milliseconds are accurate.`,
      );
    }

    return {
      fixed: fixedCount != 0,
      newChannel: channel,
    };
  }

  console.log(
    "Checking channels to make sure they weren't corrupted by random slots bug #350...",
  );
  let channels = path.join(process.env.DATABASE, 'channels');
  let channelFiles = fs.readdirSync(channels);
  for (let i = 0; i < channelFiles.length; i++) {
    if (path.extname(channelFiles[i]) === '.json') {
      console.log('Checking durations in channel : ' + channelFiles[i] + '...');
      let channelPath = path.join(channels, channelFiles[i]);
      let channel = JSON.parse(fs.readFileSync(channelPath, 'utf-8'));
      let { fixed, newChannel } = migrateChannel(channel);

      if (fixed) {
        fs.writeFileSync(channelPath, JSON.stringify(newChannel), 'utf-8');
      }
    }
  }
  console.log('Done checking channels.');
}
