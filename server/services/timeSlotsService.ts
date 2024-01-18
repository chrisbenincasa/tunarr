import { Program } from 'dizquetv-types';
import { isUndefined, shuffle as lodashShuffle } from 'lodash-es';
import constants from '../constants.js';
import { random } from '../helperFuncs.js';
import { Maybe } from '../types.js';
import { deepCopyArray } from '../util.js';
import getShowDataFunc, { ShowData } from './getShowData.js';
import throttle from './throttle.js';
import { MarkOptional } from 'ts-essentials';

const getShowData = getShowDataFunc();

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LIMIT = 40000;

// Use this to derive the minimum data we need for this service
export type ShuffleProgram = MarkOptional<
  Omit<
    Program,
    'summary' | 'icon' | 'rating' | 'ratingKey' | 'date' | 'year' | 'plexFile'
  >,
  'id'
>;

type ShowDataWithExtras = Required<ShowData> & {
  id: string;
  description: string;
};

type TimeSlot = {
  order: 'next' | 'shuffle';
  showId: string;
  time: number; // Offset from midnight in millis
};

// This is used on the frontend too, we will move common
// types eventually.
export type TimeSlotSchedule = {
  flexPreference: string; // distribute or end
  lateness: number; // max lateness in millis
  maxDays: number; // days
  pad: number; // Pad time in millis
  period: number;
  slots: TimeSlot[];
  timeZoneOffset: number; // tz offset in...minutes, i think?
};

// Hmmm...
type Iterator<T> = {
  current: () => T;
  next: () => void;
};

type SlotShow = ShowDataWithExtras & {
  founder?: ShuffleProgram; // The originating program?
  programs?: ShuffleProgram[];
  shuffler?: Iterator<ShuffleProgram>;
  orderer?: Iterator<ShuffleProgram>;
};

function getShow(program: ShuffleProgram): ShowDataWithExtras | null {
  const d = getShowData(program);
  if (!d.hasShow) {
    return null;
  } else {
    return {
      ...d,
      description: d.showDisplayName,
      id: d.showId,
    } as ShowDataWithExtras;
  }
}

function shuffle<T>(array: T[], lo: number | undefined, hi: number) {
  if (isUndefined(lo)) {
    lo = 0;
    hi = array.length;
  }
  let currentIndex = hi,
    temporaryValue: T,
    randomIndex: number;
  while (lo !== currentIndex) {
    randomIndex = random.integer(lo, currentIndex - 1);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function getProgramId(program: ShuffleProgram) {
  let s = program.serverKey;
  if (isUndefined(s)) {
    s = 'unknown';
  }
  let p = program.key;
  if (isUndefined(p)) {
    p = 'unknown';
  }
  return s + '|' + p;
}

function addProgramToShow(show: SlotShow, program: ShuffleProgram) {
  if (show.id == 'flex.' || show.id.startsWith('redirect.')) {
    //nothing to do
    return;
  }
  const id = getProgramId(program);
  if (isUndefined(show.programs)) {
    show.programs = [];
  }

  // WTF?
  if (show.programs[id] !== true) {
    show.programs.push(program);
    show.programs[id] = true;
  }
}

function getShowOrderer(show: SlotShow) {
  if (isUndefined(show.orderer)) {
    const sortedPrograms = deepCopyArray(show.programs) ?? [];
    sortedPrograms.sort((a, b) => {
      const showA = getShowData(a);
      const showB = getShowData(b);
      return (showA.order ?? 0) - (showB.order ?? 0);
    });

    let position = 0;
    while (
      position + 1 < sortedPrograms.length &&
      getShowData(show.founder!).order !==
        getShowData(sortedPrograms[position]).order
    ) {
      position++;
    }

    show.orderer = {
      current: () => {
        return sortedPrograms[position];
      },

      next: () => {
        position = (position + 1) % sortedPrograms.length;
      },
    };
  }
  return show.orderer;
}

function getShowShuffler(show: SlotShow) {
  if (isUndefined(show.shuffler)) {
    if (isUndefined(show.programs)) {
      throw Error(show.id + ' has no programs?');
    }

    // Weird state holding here - fix.
    // Also testing _.shuffle...
    const randomPrograms = lodashShuffle([...show.programs]);
    const numPrograms = randomPrograms.length;
    // shuffle(randomPrograms, 0, n);
    let position = 0;

    show.shuffler = {
      current: () => {
        return randomPrograms[position];
      },

      next: () => {
        position++;
        if (position == numPrograms) {
          const a = Math.floor(numPrograms / 2);
          shuffle(randomPrograms, 0, a);
          shuffle(randomPrograms, a, numPrograms);
          position = 0;
        }
      },
    };
  }
  return show.shuffler;
}

export default async (
  programs: ShuffleProgram[],
  schedule: TimeSlotSchedule,
) => {
  if (!Array.isArray(programs)) {
    return { userError: 'Expected a programs array' };
  }
  if (isUndefined(schedule)) {
    return { userError: 'Expected a schedule' };
  }
  if (isUndefined(schedule.timeZoneOffset)) {
    return { userError: 'Expected a time zone offset' };
  }
  //verify that the schedule is in the correct format
  if (!Array.isArray(schedule.slots)) {
    return { userError: 'Expected a "slots" array in schedule' };
  }
  if (isUndefined(schedule.period)) {
    schedule.period = DAY;
  }
  for (let i = 0; i < schedule.slots.length; i++) {
    if (isUndefined(schedule.slots[i].time)) {
      return { userError: 'Each slot should have a time' };
    }
    if (isUndefined(schedule.slots[i].showId)) {
      return { userError: 'Each slot should have a showId' };
    }
    if (
      schedule.slots[i].time < 0 ||
      schedule.slots[i].time >= schedule.period ||
      Math.floor(schedule.slots[i].time) != schedule.slots[i].time
    ) {
      return {
        userError:
          'Slot times should be a integer number of milliseconds between 0 and period-1, inclusive',
      };
    }
    schedule.slots[i].time =
      (schedule.slots[i].time +
        10 * schedule.period +
        schedule.timeZoneOffset * MINUTE) %
      schedule.period;
  }
  schedule.slots.sort((a, b) => {
    return a.time - b.time;
  });
  for (let i = 1; i < schedule.slots.length; i++) {
    if (schedule.slots[i].time == schedule.slots[i - 1].time) {
      return { userError: 'Slot times should be unique.' };
    }
  }
  if (isUndefined(schedule.pad)) {
    return { userError: 'Expected schedule.pad' };
  }

  if (typeof schedule.lateness == 'undefined') {
    return { userError: 'schedule.lateness must be defined.' };
  }
  if (typeof schedule.maxDays == 'undefined') {
    return { userError: 'schedule.maxDays must be defined.' };
  }
  if (isUndefined(schedule.flexPreference)) {
    schedule.flexPreference = 'distribute';
  }
  if (
    schedule.flexPreference !== 'distribute' &&
    schedule.flexPreference !== 'end'
  ) {
    return {
      userError: `Invalid schedule.flexPreference value: "${schedule.flexPreference}"`,
    };
  }
  const flexBetween = schedule.flexPreference !== 'end';

  // throttle so that the stream is not affected negatively
  //   let steps = 0;

  const showsById: Record<string, number> = {};
  const shows: SlotShow[] = [];

  function getNextForSlot(slot: TimeSlot, remaining?: number) {
    //remaining doesn't restrict what next show is picked. It is only used
    //for shows with flexible length (flex and redirects)
    if (slot.showId === 'flex.') {
      return {
        isOffline: true,
        duration: remaining,
      } as ShuffleProgram;
    }
    const show = shows[showsById[slot.showId]];

    if (slot.showId.startsWith('redirect.')) {
      return {
        isOffline: true,
        type: 'redirect',
        duration: remaining,
        channel: show.channel,
      } as ShuffleProgram;
    }

    switch (slot.order) {
      case 'shuffle':
        return getShowShuffler(show).current();
      case 'next':
        return getShowOrderer(show).current();
    }
  }

  function advanceSlot(slot: TimeSlot) {
    if (slot.showId === 'flex.' || slot.showId.startsWith('redirect.')) {
      return;
    }
    const show = shows[showsById[slot.showId]];

    switch (slot.order) {
      case 'shuffle':
        return getShowShuffler(show).next();
      case 'next':
        return getShowOrderer(show).next();
    }
  }

  function makePadded(item: ShuffleProgram) {
    const x = item.duration;
    const m = x % schedule.pad;
    let f = 0;
    if (m > constants.SLACK && schedule.pad - m > constants.SLACK) {
      f = schedule.pad - m;
    }
    return {
      item: item,
      pad: f,
      totalDuration: item.duration + f,
    };
  }

  // load the programs
  for (let i = 0; i < programs.length; i++) {
    const p = programs[i];
    let show: SlotShow = {
      ...(getShow(p) as ShowDataWithExtras),
      founder: p,
      programs: [],
    };
    if (show != null) {
      if (isUndefined(showsById[show.id])) {
        showsById[show.id] = shows.length;
        shows.push(show);
        show.founder = p;
        show.programs = [];
      } else {
        show = shows[showsById[show.id]];
      }
      addProgramToShow(show, p);
    }
  }

  const ts = new Date().getTime();
  const curr = ts - (ts % schedule.period);
  const t0 = curr + schedule.slots[0].time;
  const p: Partial<Program>[] = [];
  let t = t0;
  //   let wantedFinish = t % schedule.period;
  const hardLimit = t0 + schedule.maxDays * DAY;

  const pushFlex = (d: number) => {
    if (d > 0) {
      t += d;
      if (
        p.length > 0 &&
        p[p.length - 1].isOffline &&
        p[p.length - 1].type != 'redirect'
      ) {
        const currDuration = p[p.length - 1].duration ?? 0;
        p[p.length - 1].duration = currDuration + d;
      } else {
        p.push({
          duration: d,
          isOffline: true,
        });
      }
    }
  };

  const pushProgram = (item: ShuffleProgram) => {
    if (item.isOffline && item.type !== 'redirect') {
      pushFlex(item.duration);
    } else {
      p.push(item);
      t += item.duration;
    }
  };

  if (ts > t0) {
    pushFlex(ts - t0);
  }
  while (t < hardLimit && p.length < LIMIT) {
    await throttle();
    //ensure t is padded
    const m = t % schedule.pad;
    if (m > constants.SLACK && schedule.pad - m > constants.SLACK) {
      pushFlex(schedule.pad - m);
      continue;
    }

    // Milliseconds "into" the day from "curr"
    let dayTime = t % schedule.period;
    let slot: Maybe<TimeSlot>;
    let remaining: Maybe<number>;
    let late: Maybe<number>;
    for (let i = 0; i < schedule.slots.length; i++) {
      let endTime: number;
      if (i == schedule.slots.length - 1) {
        // Loop into the next day
        endTime = schedule.slots[0].time + schedule.period;
      } else {
        endTime = schedule.slots[i + 1].time;
      }

      const currSlot = schedule.slots[i];
      if (currSlot.time <= dayTime && dayTime < endTime) {
        slot = currSlot;
        remaining = endTime - dayTime;
        late = dayTime - currSlot.time;
        break;
      }
      if (
        currSlot.time <= dayTime + schedule.period &&
        dayTime + schedule.period < endTime
      ) {
        slot = currSlot;
        dayTime += schedule.period;
        remaining = endTime - dayTime;
        late = dayTime + schedule.period - currSlot.time;
        break;
      }
    }

    if (slot == null) {
      throw Error(
        'Unexpected. Unable to find slot for time of day ' + t + ' ' + dayTime,
      );
    }

    let item = getNextForSlot(slot, remaining);

    // So much potential nullness here, we will fix it...
    if ((late ?? 0) >= schedule.lateness + constants.SLACK) {
      //it's late.
      item = {
        isOffline: true,
        duration: remaining!,
        type: 'flex',
      };
    }

    if (item.isOffline) {
      //flex or redirect. We can just use the whole duration
      item.duration = remaining!;
      pushProgram(item);
      continue;
    }
    if (item.duration > remaining!) {
      // Slide
      pushProgram(item);
      advanceSlot(slot);
      continue;
    }

    const padded = makePadded(item);
    let total = padded.totalDuration;
    advanceSlot(slot);
    const pads = [padded];

    for (;;) {
      const item2 = getNextForSlot(slot, remaining);
      if (total + item2.duration > remaining!) {
        break;
      }
      const padded2 = makePadded(item2);
      pads.push(padded2);
      advanceSlot(slot);
      total += padded2.totalDuration;
    }
    const rem = Math.max(0, remaining! - total);

    if (flexBetween) {
      const div = Math.floor(rem / schedule.pad);
      const mod = rem % schedule.pad;
      // add mod to the latest item
      pads[pads.length - 1].pad += mod;
      pads[pads.length - 1].totalDuration += mod;

      const sortedPads = pads.map((p, $index) => {
        return {
          pad: p.pad,
          index: $index,
        };
      });
      sortedPads.sort((a, b) => {
        return a.pad - b.pad;
      });
      for (let i = 0; i < pads.length; i++) {
        let q = Math.floor(div / pads.length);
        if (i < div % pads.length) {
          q++;
        }
        const j = sortedPads[i].index;
        pads[j].pad += q * schedule.pad;
      }
    } else {
      //also add div to the latest item
      pads[pads.length - 1].pad += rem;
      pads[pads.length - 1].totalDuration += rem;
    }
    // now unroll them all
    for (let i = 0; i < pads.length; i++) {
      pushProgram(pads[i].item);
      pushFlex(pads[i].pad);
    }
  }
  while (t > hardLimit || p.length >= LIMIT) {
    t -= p.pop()?.duration ?? 0;
  }
  const m = (t - t0) % schedule.period;
  if (m > 0) {
    //ensure the schedule is a multiple of period
    pushFlex(schedule.period - m);
  }

  return {
    programs: p,
    startTime: new Date(t0).toISOString(),
  };
};
