import constants from '../constants.js';
import getShowDataFunc, { ShowData } from './get-show-data.js';
import { random } from '../helperFuncs.js';
import throttle from './throttle.js';
import { isUndefined } from 'lodash-es';

const getShowData = getShowDataFunc();

const MINUTE = 60 * 1000;
const DAY = 24 * 60 * MINUTE;
const LIMIT = 40000;

type ShowDataWithExtras = Required<ShowData> & {
  id: string;
  description: string;
};

function getShow(program): ShowDataWithExtras | null {
  let d = getShowData(program);
  if (!d.hasShow) {
    return null;
  } else {
    return {
      ...d,
      description: d.showDisplayName!,
      id: d.showId!,
    } as ShowDataWithExtras;
  }
}

function shuffle(array, lo, hi) {
  if (isUndefined(lo)) {
    lo = 0;
    hi = array.length;
  }
  let currentIndex = hi,
    temporaryValue,
    randomIndex;
  while (lo !== currentIndex) {
    randomIndex = random.integer(lo, currentIndex - 1);
    currentIndex -= 1;
    temporaryValue = array[currentIndex];
    array[currentIndex] = array[randomIndex];
    array[randomIndex] = temporaryValue;
  }
  return array;
}

function getProgramId(program) {
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

function addProgramToShow(show, program) {
  if (show.id == 'flex.' || show.id.startsWith('redirect.')) {
    //nothing to do
    return;
  }
  let id = getProgramId(program);
  if (show.programs[id] !== true) {
    show.programs.push(program);
    show.programs[id] = true;
  }
}

function getShowOrderer(show) {
  if (isUndefined(show.orderer)) {
    let sortedPrograms = JSON.parse(JSON.stringify(show.programs));
    sortedPrograms.sort((a, b) => {
      let showA = getShowData(a);
      let showB = getShowData(b);
      return (showA.order ?? 0) - (showB.order ?? 0);
    });

    let position = 0;
    while (
      position + 1 < sortedPrograms.length &&
      getShowData(show.founder).order !==
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

function getShowShuffler(show) {
  if (isUndefined(show.shuffler)) {
    if (isUndefined(show.programs)) {
      throw Error(show.id + ' has no programs?');
    }

    let randomPrograms = JSON.parse(JSON.stringify(show.programs));
    let n = randomPrograms.length;
    shuffle(randomPrograms, 0, n);
    let position = 0;

    show.shuffler = {
      current: () => {
        return randomPrograms[position];
      },

      next: () => {
        position++;
        if (position == n) {
          let a = Math.floor(n / 2);
          shuffle(randomPrograms, 0, a);
          shuffle(randomPrograms, a, n);
          position = 0;
        }
      },
    };
  }
  return show.shuffler;
}

export default async (programs, schedule) => {
  if (!Array.isArray(programs)) {
    return { userError: 'Expected a programs array' };
  }
  if (isUndefined(schedule)) {
    return { userError: 'Expected a schedule' };
  }
  //verify that the schedule is in the correct format
  if (!Array.isArray(schedule.slots)) {
    return { userError: 'Expected a "slots" array in schedule' };
  }
  if (isUndefined(schedule.period)) {
    schedule.period = DAY;
  }
  for (let i = 0; i < schedule.slots.length; i++) {
    if (isUndefined(schedule.slots[i].duration)) {
      return { userError: 'Each slot should have a duration' };
    }
    if (isUndefined(schedule.slots[i].showId)) {
      return { userError: 'Each slot should have a showId' };
    }
    if (
      schedule.slots[i].duration <= 0 ||
      Math.floor(schedule.slots[i].duration) != schedule.slots[i].duration
    ) {
      return {
        userError:
          'Slot duration should be a integer number of milliseconds greater than 0',
      };
    }
    if (isNaN(schedule.slots[i].cooldown)) {
      schedule.slots[i].cooldown = 0;
    }
    if (isNaN(schedule.slots[i].weight)) {
      schedule.slots[i].weight = 1;
    }
  }
  if (isUndefined(schedule.pad)) {
    return { userError: 'Expected schedule.pad' };
  }
  if (typeof schedule.maxDays == 'undefined') {
    return { userError: 'schedule.maxDays must be defined.' };
  }
  if (isUndefined(schedule.flexPreference)) {
    schedule.flexPreference = 'distribute';
  }
  if (isUndefined(schedule.padStyle)) {
    schedule.padStyle = 'slot';
  }
  if (schedule.padStyle !== 'slot' && schedule.padStyle !== 'episode') {
    return {
      userError: `Invalid schedule.padStyle value: "${schedule.padStyle}"`,
    };
  }
  let flexBetween = schedule.flexPreference !== 'end';

  // throttle so that the stream is not affected negatively
  // let steps = 0;

  let showsById: object = {};
  let shows: any[] = [];

  function getNextForSlot(slot, remaining) {
    //remaining doesn't restrict what next show is picked. It is only used
    //for shows with flexible length (flex and redirects)
    if (slot.showId === 'flex.') {
      return {
        isOffline: true,
        duration: remaining,
      };
    }
    let show = shows[showsById[slot.showId]];
    if (slot.showId.startsWith('redirect.')) {
      return {
        isOffline: true,
        type: 'redirect',
        duration: remaining,
        channel: show.channel,
      };
    } else if (slot.order === 'shuffle') {
      return getShowShuffler(show).current();
    } else if (slot.order === 'next') {
      return getShowOrderer(show).current();
    }
  }

  function advanceSlot(slot) {
    if (slot.showId === 'flex.' || slot.showId.startsWith('redirect')) {
      return;
    }
    let show = shows[showsById[slot.showId]];
    if (slot.order === 'shuffle') {
      return getShowShuffler(show).next();
    } else if (slot.order === 'next') {
      return getShowOrderer(show).next();
    }
  }

  function makePadded(item) {
    let padOption = schedule.pad;
    if (schedule.padStyle === 'slot') {
      padOption = 1;
    }
    let x = item.duration;
    let m = x % padOption;
    let f = 0;
    if (m > constants.SLACK && padOption - m > constants.SLACK) {
      f = padOption - m;
    }
    return {
      item: item,
      pad: f,
      totalDuration: item.duration + f,
    };
  }

  // load the programs
  for (let i = 0; i < programs.length; i++) {
    let p = programs[i];
    let show = getShow(p);
    if (show != null) {
      if (isUndefined(showsById[show.id])) {
        showsById[show.id] = shows.length;
        // What's going on here....
        shows.push({ ...show, founder: p, programs: [] });
        // show.founder = p;
        // show.programs = [];
      } else {
        show = shows[showsById[show.id]];
      }
      addProgramToShow(show, p);
    }
  }

  let s = schedule.slots;
  let ts = new Date().getTime();

  let t0 = ts;
  let p: any[] = [];
  let t = t0;

  let hardLimit = t0 + schedule.maxDays * DAY;

  let pushFlex = (d) => {
    if (d > 0) {
      t += d;
      if (
        p.length > 0 &&
        p[p.length - 1].isOffline &&
        p[p.length - 1].type != 'redirect'
      ) {
        p[p.length - 1].duration += d;
      } else {
        p.push({
          duration: d,
          isOffline: true,
        });
      }
    }
  };

  let pushProgram = (item) => {
    if (item.isOffline && item.type !== 'redirect') {
      pushFlex(item.duration);
    } else {
      p.push(item);
      t += item.duration;
    }
  };

  let slotLastPlayed = {};

  while (t < hardLimit && p.length < LIMIT) {
    await throttle();
    //ensure t is padded
    let m = t % schedule.pad;
    if (
      t % schedule.pad > constants.SLACK &&
      schedule.pad - m > constants.SLACK
    ) {
      pushFlex(schedule.pad - m);
      continue;
    }

    let slot = null;
    let slotIndex: number;
    let remaining: number;

    let n = 0;
    let minNextTime = t + 24 * DAY;
    for (let i = 0; i < s.length; i++) {
      if (typeof slotLastPlayed[i] !== undefined) {
        let lastt = slotLastPlayed[i];
        minNextTime = Math.min(minNextTime, lastt + s[i].cooldown);
        if (t - lastt < s[i].cooldown - constants.SLACK) {
          continue;
        }
      }
      n += s[i].weight;
      if (random.bool(s[i].weight, n)) {
        slot = s[i];
        slotIndex = i;
        remaining = s[i].duration;
      }
    }
    if (slot == null) {
      //Nothing to play, likely due to cooldown
      pushFlex(minNextTime - t);
      continue;
    }
    let item = getNextForSlot(slot, remaining!);

    if (item.isOffline) {
      //flex or redirect. We can just use the whole duration
      item.duration = remaining!;
      pushProgram(item);
      slotLastPlayed[slotIndex!] = t;
      continue;
    }
    if (item.duration > remaining!) {
      // Slide
      pushProgram(item);
      slotLastPlayed[slotIndex!] = t;
      advanceSlot(slot);
      continue;
    }

    let padded = makePadded(item);
    let total = padded.totalDuration;
    advanceSlot(slot);
    let pads = [padded];

    while (true) {
      let item2 = getNextForSlot(slot, undefined);
      if (total + item2.duration > remaining!) {
        break;
      }
      let padded2 = makePadded(item2);
      pads.push(padded2);
      advanceSlot(slot);
      total += padded2.totalDuration;
    }
    let temt = t + total;
    let rem = 0;
    if (
      temt % schedule.pad >= constants.SLACK &&
      temt % schedule.pad < schedule.pad - constants.SLACK
    ) {
      rem = schedule.pad - (temt % schedule.pad);
    }

    if (flexBetween && schedule.padStyle === 'episode') {
      let div = Math.floor(rem / schedule.pad);
      let mod = rem % schedule.pad;
      // add mod to the latest item
      pads[pads.length - 1].pad += mod;
      pads[pads.length - 1].totalDuration += mod;

      let sortedPads = pads.map((p, $index) => {
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
        let j = sortedPads[i].index;
        pads[j].pad += q * schedule.pad;
      }
    } else if (flexBetween) {
      //just distribute it equitatively
      let div = Math.floor(rem / pads.length);
      let totalAdded = 0;
      for (let i = 0; i < pads.length; i++) {
        pads[i].pad += div;
        totalAdded += div;
      }
      pads[0].pad += rem - totalAdded;
    } else {
      //also add div to the latest item
      pads[pads.length - 1].pad += rem;
      pads[pads.length - 1].totalDuration += rem;
    }
    // now unroll them all
    for (let i = 0; i < pads.length; i++) {
      pushProgram(pads[i].item);
      slotLastPlayed[slotIndex!] = t;
      pushFlex(pads[i].pad);
    }
  }
  while (t > hardLimit || p.length >= LIMIT) {
    t -= p.pop().duration;
  }
  let m = (t - t0) % schedule.period;
  if (m != 0) {
    //ensure the schedule is a multiple of period
    pushFlex(schedule.period - m);
  }

  return {
    programs: p,
    startTime: new Date(t0).toISOString(),
  };
};
