import type {
  BaseSlot,
  RandomSlotSchedule,
  TimeSlotSchedule,
} from '@tunarr/types/api';
import { isEmpty, orderBy } from 'lodash-es';
import { slotIteratorKey } from './ProgramIterator.ts';
import type { PeriodPlays, SlotIteratorState } from './slotIteratorState.ts';
import { assignIteratorKeys } from './slotSchedulerUtil.ts';

type SlotSchedule = TimeSlotSchedule | RandomSlotSchedule;

// What a slot plays and in which order. Two slots with the same identity can
// carry each other's place in the schedule. Season filters change which
// episodes a show slot plays, so they are part of it.
function slotIdentity(slot: BaseSlot): string {
  const direction = 'direction' in slot ? slot.direction : '';
  const seasons =
    slot.type === 'show'
      ? JSON.stringify([slot.seasonFilter, slot.seasonExcludeFilter])
      : '';
  return `${slotIteratorKey(slot)}|${direction}|${seasons}`;
}

// Each iterator key with the identity of the first slot that uses it.
function keyIdentities(slots: BaseSlot[]): Map<string, string> {
  const identities = new Map<string, string>();
  for (const [index, key] of assignIteratorKeys(slots).entries()) {
    const slot = slots[index];
    if (slot && !identities.has(key)) {
      identities.set(key, slotIdentity(slot));
    }
  }
  return identities;
}

// Pairs each new entry with an old one of the same identity. An entry that
// kept its key keeps its state first; the rest pair up in order.
function matchByIdentity(
  previous: Map<string, string>,
  next: Map<string, string>,
): Map<string, string> {
  const matched = new Map<string, string>();
  const used = new Set<string>();

  for (const [key, identity] of next) {
    if (previous.get(key) === identity) {
      matched.set(key, key);
      used.add(key);
    }
  }

  for (const [key, identity] of next) {
    if (matched.has(key)) continue;
    for (const [oldKey, oldIdentity] of previous) {
      if (!used.has(oldKey) && oldIdentity === identity) {
        matched.set(key, oldKey);
        used.add(oldKey);
        break;
      }
    }
  }

  return matched;
}

// Random slots index their cooldowns and sequence by position in this order.
function sortedSlotIdentities(
  schedule: RandomSlotSchedule,
): Map<string, string> {
  const sorted = orderBy(
    schedule.slots.map((slot, index) => ({ slot, index })),
    ({ slot, index }) => slot.index ?? index,
    'asc',
  );
  return new Map(
    sorted.map(({ slot }, position) => [String(position), slotIdentity(slot)]),
  );
}

/**
 * Carries scheduler state from one version of a schedule to an edited one.
 *
 * A slot keeps its place when the edited schedule still has a slot with the
 * same content, order and direction. Moving, retiming or relinking a slot
 * keeps it. Changing what it plays or how it orders starts that slot over.
 */
export function remapIteratorState(
  state: SlotIteratorState,
  previous: SlotSchedule,
  next: SlotSchedule,
): SlotIteratorState {
  const keys = matchByIdentity(
    keyIdentities(previous.slots),
    keyIdentities(next.slots),
  );

  const remapped: SlotIteratorState = { iterators: {} };
  const rerunPlays: Record<string, number> = {};
  const periodPlays: Record<string, PeriodPlays> = {};
  for (const [key, oldKey] of keys) {
    const snapshot = state.iterators[oldKey];
    if (snapshot) {
      remapped.iterators[key] = snapshot;
    }
    const plays = state.rerunPlays?.[oldKey];
    if (plays !== undefined) {
      rerunPlays[key] = plays;
    }
    // Rerun slots read their cursors by position in the group. A slot added
    // past the stored ones starts at the oldest unreplayed program.
    const recording = state.periodPlays?.[oldKey];
    if (recording) {
      periodPlays[key] = recording;
    }
  }
  if (!isEmpty(rerunPlays)) {
    remapped.rerunPlays = rerunPlays;
  }
  if (!isEmpty(periodPlays)) {
    remapped.periodPlays = periodPlays;
  }

  if (previous.type !== 'random' || next.type !== 'random') {
    return remapped;
  }

  const positions = matchByIdentity(
    sortedSlotIdentities(previous),
    sortedSlotIdentities(next),
  );

  const slotLastPlayedMs: Record<string, number> = {};
  for (const [position, oldPosition] of positions) {
    const timeMs = state.slotLastPlayedMs?.[oldPosition];
    if (timeMs !== undefined) {
      slotLastPlayedMs[position] = timeMs;
    }
  }
  remapped.slotLastPlayedMs = slotLastPlayedMs;

  if (state.nextSlotIndex !== undefined) {
    const oldPosition = String(state.nextSlotIndex);
    for (const [position, matchedPosition] of positions) {
      if (matchedPosition === oldPosition) {
        remapped.nextSlotIndex = Number(position);
        break;
      }
    }
  }

  return remapped;
}
