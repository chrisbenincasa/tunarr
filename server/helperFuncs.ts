import { isNil, isUndefined, pick } from 'lodash-es';
import * as randomJS from 'random-js';
import { DeepReadonly } from 'ts-essentials';
import { ChannelCache } from './channelCache.js';
import constants from './constants.js';
import {
  FfmpegSettings,
  FillerCollection,
  ImmutableChannel,
  Program,
  Watermark,
  offlineProgram,
} from './dao/db.js';
import {
  CHANNEL_CONTEXT_KEYS,
  CommercialLineupItem,
  ContextChannel,
  Intersection,
  LineupItem,
  Maybe,
  programToCommercial,
} from './types.js';

const SLACK = constants.SLACK;
const Random = randomJS.Random;
export const random = new Random(randomJS.MersenneTwister19937.autoSeed());

// Figure out this type later...
type PartialCommercialType = Omit<
  Intersection<CommercialLineupItem, Program> &
    Pick<CommercialLineupItem, 'fillerId'>,
  'duration'
> & { duration: number };

export type ProgramAndTimeElapsed = {
  program: DeepReadonly<Program> & { err?: Error };
  timeElapsed: number;
  programIndex: number;
};

export function getCurrentProgramAndTimeElapsed(
  date: number,
  channel: ImmutableChannel,
): ProgramAndTimeElapsed {
  const channelStartTime = new Date(channel.startTimeEpoch).getTime();
  if (channelStartTime > date) {
    const t0 = date;
    const t1 = channelStartTime;
    console.log(
      'Channel start time is above the given date. Flex time is picked till that.',
    );
    return {
      program: offlineProgram(t1 - t0),
      timeElapsed: 0,
      programIndex: -1,
    };
  }
  let timeElapsed = (date - channelStartTime) % channel.duration;
  let currentProgramIndex = -1;
  for (let y = 0, l2 = channel.programs.length; y < l2; y++) {
    const program = channel.programs[y];
    if (timeElapsed - program.duration < 0) {
      currentProgramIndex = y;
      if (
        program.duration > 2 * SLACK &&
        timeElapsed > program.duration - SLACK
      ) {
        timeElapsed = 0;
        currentProgramIndex = (y + 1) % channel.programs.length;
      }
      break;
    } else {
      timeElapsed -= program.duration;
    }
  }

  if (currentProgramIndex === -1)
    throw new Error('No program found; find algorithm fucked up');

  return {
    program: channel.programs[currentProgramIndex],
    timeElapsed: timeElapsed,
    programIndex: currentProgramIndex,
  };
}

export function createLineup(
  channelCache: ChannelCache,
  obj: ProgramAndTimeElapsed,
  channel: ImmutableChannel,
  fillers: (FillerCollection & { content: Program[] })[],
  isFirst: boolean,
): LineupItem[] {
  let timeElapsed = obj.timeElapsed;
  // Start time of a file is never consistent unless 0. Run time of an episode can vary.
  // When within 30 seconds of start time, just make the time 0 to smooth things out
  // Helps prevents loosing first few seconds of an episode upon lineup change
  const activeProgram = obj.program;
  let beginningOffset = 0;

  const lineup: LineupItem[] = [];

  if (!isUndefined(activeProgram.err)) {
    const remaining = activeProgram.duration - timeElapsed;
    lineup.push({
      type: 'offline',
      title: 'Error',
      err: activeProgram.err,
      streamDuration: remaining,
      duration: remaining,
      start: 0,
      beginningOffset: beginningOffset,
    });
    return lineup;
  }

  if (activeProgram.isOffline === true) {
    //offline case
    let remaining = activeProgram.duration - timeElapsed;
    //look for a random filler to play
    let filler: Maybe<Program | PartialCommercialType>;
    let special: Maybe<Program>;

    if (channel.offline.mode === 'clip' && channel.fallback.length != 0) {
      special = { ...channel.fallback[0] };
    }
    const randomResult = pickRandomWithMaxDuration(
      channelCache,
      channel,
      fillers,
      remaining + (isFirst ? 7 * 24 * 60 * 60 * 1000 : 0),
    );
    filler = randomResult.filler;
    if (
      isNil(filler) &&
      // typeof randomResult.minimumWait !== undefined &&
      remaining > randomResult.minimumWait
    ) {
      remaining = randomResult.minimumWait;
    }

    let isSpecial = false;
    if (isNil(filler)) {
      filler = special;
      isSpecial = true;
    }
    if (!isNil(filler)) {
      let fillerstart = 0;
      if (isSpecial) {
        if ((filler as Program).duration > remaining) {
          fillerstart = (filler as Program).duration - remaining;
        } else {
          fillerstart = 0;
        }
      } else if (isFirst) {
        fillerstart = Math.max(0, filler.duration - remaining);
        //it's boring and odd to tune into a channel and it's always
        //the start of a commercial.
        const more = Math.max(0, filler.duration - fillerstart - 15000 - SLACK);
        fillerstart += random.integer(0, more);
      }

      lineup.push({
        // just add the video, starting at 0, playing the entire duration
        type: 'commercial',
        title: filler.title,
        key: filler.key,
        plexFile: filler.plexFile,
        file: filler.file,
        ratingKey: filler.ratingKey,
        start: fillerstart,
        streamDuration: Math.max(
          1,
          Math.min(filler.duration - fillerstart, remaining),
        ),
        duration: filler.duration,
        fillerId: filler.type === 'commercial' ? filler.fillerId : '', // Is this used...
        beginningOffset: beginningOffset,
        serverKey: filler.serverKey,
      });
      return lineup;
    }
    // pick the offline screen
    remaining = Math.min(remaining, 10 * 60 * 1000);
    //don't display the offline screen for longer than 10 minutes. Maybe the
    //channel's admin might change the schedule during that time and then
    //it would be better to start playing the content.
    lineup.push({
      type: 'offline',
      title: 'Channel Offline',
      streamDuration: remaining,
      beginningOffset: beginningOffset,
      duration: remaining,
      start: 0,
    });
    return lineup;
  }
  const originalTimeElapsed = timeElapsed;
  if (timeElapsed < 30000) {
    timeElapsed = 0;
  }
  beginningOffset = Math.max(0, originalTimeElapsed - timeElapsed);

  return [
    {
      type: 'program',
      title: activeProgram.title,
      key: activeProgram.key,
      plexFile: activeProgram.plexFile,
      file: activeProgram.file,
      ratingKey: activeProgram.ratingKey,
      start: timeElapsed,
      streamDuration: activeProgram.duration - timeElapsed,
      beginningOffset: beginningOffset,
      duration: activeProgram.duration,
      serverKey: activeProgram.serverKey,
    },
  ];
}

function weighedPick(a: number, total: number) {
  return random.bool(a, total);
}

function pickRandomWithMaxDuration(
  channelCache: ChannelCache,
  channel: ImmutableChannel,
  fillers: (FillerCollection & { content: Program[] })[],
  maxDuration: number,
): { filler: Maybe<PartialCommercialType>; minimumWait: number } {
  let list: Program[] = [];
  for (let i = 0; i < fillers.length; i++) {
    list = list.concat(fillers[i].content);
  }

  let pick1: Maybe<Program>;
  const t0 = new Date().getTime();
  let minimumWait = 1000000000;
  const D = 7 * 24 * 60 * 60 * 1000;
  const E = 5 * 60 * 60 * 1000;
  let fillerRepeatCooldownMs = 0;
  if (isUndefined(channel.fillerRepeatCooldown)) {
    fillerRepeatCooldownMs = 30 * 60 * 1000;
  }

  let listM = 0;
  let fillerId: Maybe<string> = undefined;
  for (let j = 0; j < fillers.length; j++) {
    list = fillers[j].content;
    let pickedList = false;
    let n = 0;

    for (let i = 0; i < list.length; i++) {
      const clip: Program = list[i];
      // a few extra milliseconds won't hurt anyone, would it? dun dun dun
      if (clip.duration <= maxDuration + SLACK) {
        const t1 = channelCache.getProgramLastPlayTime(channel.number, clip);
        let timeSince = t1 == 0 ? D : t0 - t1;

        if (timeSince < fillerRepeatCooldownMs - SLACK) {
          const w = fillerRepeatCooldownMs - timeSince;
          if (clip.duration + w <= maxDuration + SLACK) {
            minimumWait = Math.min(minimumWait, w);
          }
          timeSince = 0;
          //30 minutes is too little, don't repeat it at all
        } else if (!pickedList) {
          const t1 = channelCache.getFillerLastPlayTime(
            channel.number,
            fillers[j].id,
          );
          const timeSince = t1 == 0 ? D : t0 - t1;
          if (timeSince + SLACK >= fillers[j].cooldownSeconds) {
            //should we pick this list?
            listM += fillers[j].weight;
            if (weighedPick(fillers[j].weight, listM)) {
              pickedList = true;
              fillerId = fillers[j].id;
              n = 0;
            } else {
              break;
            }
          } else {
            const w = fillers[j].cooldownSeconds - timeSince;
            if (clip.duration + w <= maxDuration + SLACK) {
              minimumWait = Math.min(minimumWait, w);
            }

            break;
          }
        }
        if (timeSince <= 0) {
          continue;
        }
        const s = norm_s(timeSince >= E ? E : timeSince);
        const d = norm_d(clip.duration);
        const w = s + d;
        n += w;
        if (weighedPick(w, n)) {
          pick1 = clip;
        }
      }
    }
  }

  let pick: Maybe<PartialCommercialType>;
  if (!isNil(pick1)) {
    pick = {
      ...programToCommercial(pick1),
      fillerId: fillerId!,
      duration: pick1.duration,
    };
  }

  return {
    filler: pick,
    minimumWait: minimumWait,
  };
}

function norm_d(x: number) {
  x /= 60 * 1000;
  if (x >= 3.0) {
    x = 3.0 + Math.log(x);
  }
  const y = 10000 * (Math.ceil(x * 1000) + 1);
  return Math.ceil(y / 1000000) + 1;
}

function norm_s(x) {
  let y = Math.ceil(x / 600) + 1;
  y = y * y;
  return Math.ceil(y / 1000000) + 1;
}

// any channel thing used here should be added to channel context
export function getWatermark(
  ffmpegSettings: FfmpegSettings,
  channel: ContextChannel,
  type: string,
): Maybe<Watermark> {
  if (
    !ffmpegSettings.enableTranscoding ||
    ffmpegSettings.disableChannelOverlay
  ) {
    return;
  }

  let disableFillerOverlay = channel.disableFillerOverlay;
  if (isUndefined(disableFillerOverlay)) {
    disableFillerOverlay = true;
  }

  if (type == 'commercial' && disableFillerOverlay) {
    return;
  }

  let icon: Maybe<string>;
  let watermark: Maybe<Watermark>;
  if (!isUndefined(channel.watermark)) {
    watermark = { ...channel.watermark };
    if (!watermark.enabled) {
      return;
    }

    icon = watermark.url;
    if (isUndefined(icon) || icon === '') {
      icon = channel.icon?.path;
      if (isUndefined(icon) || icon === '') {
        return;
      }
    }

    return {
      enabled: true,
      url: icon,
      width: watermark.width,
      verticalMargin: watermark.verticalMargin,
      horizontalMargin: watermark.horizontalMargin,
      duration: watermark.duration,
      position: watermark.position,
      fixedSize: watermark.fixedSize === true,
      animated: watermark.animated === true,
    };
  }

  return;
}

export function generateChannelContext(
  channel: ImmutableChannel,
): ContextChannel {
  return pick(
    channel,
    CHANNEL_CONTEXT_KEYS as ReadonlyArray<keyof ImmutableChannel>,
  );
}
