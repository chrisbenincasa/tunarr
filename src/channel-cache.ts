const SLACK = require('./constants').SLACK;

let cache = {};
let programPlayTimeCache = {};
let fillerPlayTimeCache = {};
let configCache = {};
let numbers = null;

export async function getChannelConfig(channelDB, channelId) {
  //with lazy-loading

  if (typeof configCache[channelId] === 'undefined') {
    let channel = await channelDB.getChannel(channelId);
    if (channel == null) {
      configCache[channelId] = [];
    } else {
      //console.log("channel=" + JSON.stringify(channel) );
      configCache[channelId] = [channel];
    }
  }
  //console.log("channel=" + JSON.stringify(configCache[channelId]).slice(0,200) );
  return configCache[channelId];
}

export async function getAllNumbers(channelDB) {
  if (numbers === null) {
    let n = channelDB.getAllChannelNumbers();
    numbers = n;
  }
  return numbers;
}

export async function getAllChannels(channelDB) {
  let channelNumbers = await getAllNumbers(channelDB);
  return await Promise.all(
    channelNumbers.map(async (x) => {
      return (await getChannelConfig(channelDB, x))[0];
    }),
  );
}

export function saveChannelConfig(number, channel) {
  configCache[number] = [channel];
}

export function getCurrentLineupItem(channelId, t1) {
  if (typeof cache[channelId] === 'undefined') {
    return null;
  }
  let recorded = cache[channelId];
  let lineupItem = JSON.parse(JSON.stringify(recorded.lineupItem));
  let diff = t1 - recorded.t0;
  let rem = lineupItem.duration - lineupItem.start;
  if (typeof lineupItem.streamDuration !== 'undefined') {
    rem = Math.min(rem, lineupItem.streamDuration);
  }
  if (diff <= SLACK && diff + SLACK < rem) {
    //closed the stream and opened it again let's not lose seconds for
    //no reason
    let originalT0 = recorded.lineupItem.originalT0;
    if (typeof originalT0 === 'undefined') {
      originalT0 = recorded.t0;
    }
    if (t1 - originalT0 <= SLACK) {
      lineupItem.originalT0 = originalT0;
      return lineupItem;
    }
  }

  lineupItem.start += diff;
  if (typeof lineupItem.streamDuration !== 'undefined') {
    lineupItem.streamDuration -= diff;
    if (lineupItem.streamDuration < SLACK) {
      //let's not waste time playing some loose seconds
      return null;
    }
  }
  if (lineupItem.start + SLACK > lineupItem.duration) {
    return null;
  }
  return lineupItem;
}

function getKey(channelId, program) {
  let serverKey = '!unknown!';
  if (typeof program.serverKey !== 'undefined') {
    if (typeof program.serverKey !== 'undefined') {
      serverKey = 'plex|' + program.serverKey;
    }
  }
  let programKey = '!unknownProgram!';
  if (typeof program.key !== 'undefined') {
    programKey = program.key;
  }
  return channelId + '|' + serverKey + '|' + programKey;
}

function getFillerKey(channelId, fillerId) {
  return channelId + '|' + fillerId;
}

function recordProgramPlayTime(channelId, lineupItem, t0) {
  let remaining;
  if (typeof lineupItem.streamDuration !== 'undefined') {
    remaining = lineupItem.streamDuration;
  } else {
    remaining = lineupItem.duration - lineupItem.start;
  }
  programPlayTimeCache[getKey(channelId, lineupItem)] = t0 + remaining;
  if (typeof lineupItem.fillerId !== 'undefined') {
    fillerPlayTimeCache[getFillerKey(channelId, lineupItem.fillerId)] =
      t0 + remaining;
  }
}

export function getProgramLastPlayTime(channelId, program) {
  let v = programPlayTimeCache[getKey(channelId, program)];
  if (typeof v === 'undefined') {
    return 0;
  } else {
    return v;
  }
}

export function getFillerLastPlayTime(channelId, fillerId) {
  let v = fillerPlayTimeCache[getFillerKey(channelId, fillerId)];
  if (typeof v === 'undefined') {
    return 0;
  } else {
    return v;
  }
}

export function recordPlayback(channelId, t0, lineupItem) {
  recordProgramPlayTime(channelId, lineupItem, t0);

  cache[channelId] = {
    t0: t0,
    lineupItem: lineupItem,
  };
}

export function clearPlayback(channelId) {
  delete cache[channelId];
}

export function clear() {
  //it's not necessary to clear the playback cache and it may be undesirable
  configCache = {};
  cache = {};
  numbers = null;
}
