import { InfiniteScheduleDB } from '@/db/InfiniteScheduleDB.js';
import type { ProgramWithRelationsOrm } from '@/db/schema/derivedTypes.js';
import type {
  GeneratedItemType,
  NewGeneratedScheduleItem,
} from '@/db/schema/GeneratedScheduleItem.js';
import type { InfiniteSchedule } from '@/db/schema/InfiniteSchedule.js';
import type { InfiniteScheduleSlot } from '@/db/schema/InfiniteScheduleSlot.js';
import type {
  InfiniteScheduleSlotState,
  SlotFillerPersistenceState,
} from '@/db/schema/InfiniteScheduleSlotState.js';
import type { InfiniteScheduleState } from '@/db/schema/InfiniteScheduleState.js';
import { KEYS } from '@/types/inject.js';
import dayjs from '@/util/dayjs.js';
import { nullToUndefined, seq } from '@tunarr/shared/util';
import type { SlotFillerTypes } from '@tunarr/types/api';
import { inject, injectable } from 'inversify';
import { isNil, sortBy, sumBy } from 'lodash-es';
import { createEntropy, MersenneTwister19937, Random } from 'random-js';
import { v4 } from 'uuid';
import { Nullable } from '../../types/util.ts';
import { isDefined } from '../../util/index.ts';
import type { Logger } from '../../util/logging/LoggerFactory.js';
import { InfiniteSlotFillerHelper } from './InfiniteSlotFillerHelper.ts';
import { SlotSchedulerHelper } from './SlotSchedulerHelper.ts';

export interface GenerationResult {
  items: NewGeneratedScheduleItem[];
  fromTimeMs: number;
  toTimeMs: number;
  slotStates: Map<string, SlotStateUpdate>;
  scheduleStateUpdate: ScheduleStateUpdate;
}

export interface SlotStateUpdate {
  rngSeed: number[];
  iteratorPosition: number;
  rngUseCount: number;
  lastScheduledAt: Date;
  shuffleOrder?: string[] | null;
  fillModeCount: number;
  fillModeDurationMs: number;
  fillerState: SlotFillerPersistenceState | null;
}

interface ScheduleStateUpdate {
  floatingSlotIndex: number;
  generationCursor: number;
  slotSelectionSeed: number[] | null;
  slotSelectionUseCount: number;
}

type SlotWithState = InfiniteScheduleSlot & {
  state: InfiniteScheduleSlotState | null;
};

type InfiniteScheduleWithSlotsAndState = InfiniteSchedule & {
  slots: SlotWithState[];
  state: InfiniteScheduleState | null;
};

interface SlotPrograms {
  slot: SlotWithState;
  programs: ProgramWithRelationsOrm[];
  iterator: SlotIterator;
  fillerHelper: InfiniteSlotFillerHelper | null;
}

interface AnchorEvent {
  /** UTC timestamp when this anchored slot fires */
  timeMs: number;
  slotPrograms: SlotPrograms;
}

interface IteratorStateUpdate {
  rngSeed: number[];
  iteratorPosition: number;
  rngUseCount: number;
  lastScheduledAt: Date;
  shuffleOrder: string[] | null;
}

interface SlotIterator {
  position: number;
  programs: ProgramWithRelationsOrm[];
  shuffleOrder: string[] | null;
  current(): ProgramWithRelationsOrm | null;
  next(): void;
  getState(): IteratorStateUpdate;
}

@injectable()
export class InfiniteScheduleGenerator {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.InfiniteScheduleDB)
    private infiniteScheduleDB: InfiniteScheduleDB,
    @inject(SlotSchedulerHelper)
    private slotSchedulerHelper: SlotSchedulerHelper,
  ) {}

  /**
   * Generate schedule items for a given channel and persist results.
   * The channel's associated schedule is loaded automatically.
   */
  async generate(
    channelUuid: string,
    fromTimeMs?: number,
    toTimeMs?: number,
  ): Promise<GenerationResult> {
    const schedule =
      await this.infiniteScheduleDB.getScheduleByChannelWithState(channelUuid);
    if (!schedule) {
      throw new Error(`No schedule found for channel ${channelUuid}`);
    }

    const now = +dayjs();
    const from = fromTimeMs ?? now;
    const to = toTimeMs ?? from + schedule.bufferDays * 24 * 60 * 60 * 1000;

    this.logger.debug(
      'Generating schedule from %d to %d (%d days)',
      from,
      to,
      (to - from) / (24 * 60 * 60 * 1000),
    );

    // Ensure per-channel slot state rows exist before generating
    const slotUuids = schedule.slots.map((s) => s.uuid);
    await this.infiniteScheduleDB.ensureChannelSlotStates(
      channelUuid,
      slotUuids,
    );

    const startSequenceIndex =
      await this.infiniteScheduleDB.getNextSequenceIndex(channelUuid);

    const slotPrograms = await this.collectSlotPrograms(schedule);
    const result = this.generateScheduleItems(
      channelUuid,
      schedule,
      slotPrograms,
      from,
      to,
      startSequenceIndex,
    );

    // Persist results
    await this.infiniteScheduleDB.insertGeneratedItems(result.items);
    for (const [slotUuid, update] of result.slotStates) {
      await this.infiniteScheduleDB.updateSlotState(
        channelUuid,
        slotUuid,
        update,
      );
    }
    await this.infiniteScheduleDB.upsertScheduleState(
      channelUuid,
      schedule.uuid,
      result.scheduleStateUpdate,
    );

    return result;
  }

  /**
   * Preview schedule generation without persisting.
   * Uses a throwaway channelUuid since preview items are never written to the DB.
   */
  async preview(
    schedule: Omit<InfiniteScheduleWithSlotsAndState, 'uuid'>,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<GenerationResult> {
    const previewChannelUuid = v4();
    const scheduleWithUuid: InfiniteScheduleWithSlotsAndState = {
      ...schedule,
      uuid: v4(),
      state: null,
      slots: schedule.slots.map((slot) => ({
        ...slot,
        uuid: slot.uuid ?? v4(),
      })),
    };

    const slotPrograms = await this.collectSlotPrograms(scheduleWithUuid);
    return this.generateScheduleItems(
      previewChannelUuid,
      scheduleWithUuid,
      slotPrograms,
      fromTimeMs,
      toTimeMs,
      0,
    );
  }

  /**
   * Collect programs for all slots in the schedule.
   */
  private async collectSlotPrograms(
    schedule: InfiniteScheduleWithSlotsAndState,
  ): Promise<SlotPrograms[]> {
    const results: SlotPrograms[] = [];

    for (const slot of schedule.slots) {
      const programs = await this.getProgramsForSlot(slot);
      const iterator = this.createIterator(slot, programs);

      const fillerDefs = slot.fillerConfig?.fillers;
      let fillerHelper: InfiniteSlotFillerHelper | null = null;

      if (fillerDefs && fillerDefs.length > 0) {
        const listIds = new Set(fillerDefs.map((f) => f.fillerListId));
        const programsByListId =
          await this.slotSchedulerHelper.materializeFillerLists(listIds);

        const persistedFillerState = slot.state?.fillerState ?? null;
        const fillerSeed = persistedFillerState?.rngSeed ?? createEntropy();
        const fillerUseCount = persistedFillerState?.rngUseCount ?? 0;
        const fillerMt =
          MersenneTwister19937.seedWithArray(fillerSeed).discard(
            fillerUseCount,
          );
        const fillerRandom = new Random(fillerMt);

        fillerHelper = new InfiniteSlotFillerHelper(
          fillerDefs,
          programsByListId,
          fillerRandom,
          fillerMt,
          fillerSeed,
          persistedFillerState,
        );
      }

      results.push({ slot, programs, iterator, fillerHelper });
    }

    return results;
  }

  /**
   * Get programs for a specific slot based on its type.
   */
  private async getProgramsForSlot(
    slot: SlotWithState,
  ): Promise<ProgramWithRelationsOrm[]> {
    switch (slot.slotType) {
      case 'show':
        if (!slot.showId) return [];
        return this.getShowPrograms(
          slot.showId,
          nullToUndefined(slot.slotConfig?.seasonFilter),
        );

      case 'custom-show': {
        if (!slot.customShowId) return [];
        const programs =
          await this.slotSchedulerHelper.materializeCustomShowPrograms(
            new Set([slot.customShowId]),
          );
        return Object.values(programs).flat();
      }
      case 'filler': {
        if (!slot.fillerListId) return [];
        const programs = await this.slotSchedulerHelper.materializeFillerLists(
          new Set([slot.fillerListId]),
        );
        return Object.values(programs).flat();
      }
      case 'smart-collection': {
        if (!slot.smartCollectionId) return [];
        const documents =
          await this.slotSchedulerHelper.materializeSmartCollections(
            new Set([slot.smartCollectionId]),
          );
        return Object.values(documents).flat();
      }
      case 'redirect':
      case 'flex':
        return [];
    }
  }

  /**
   * Get programs for a show, optionally filtered by season.
   */
  private async getShowPrograms(
    showId: string,
    seasonFilter?: number[],
  ): Promise<ProgramWithRelationsOrm[]> {
    const programs = await this.slotSchedulerHelper.materializeShows(
      new Set([showId]),
    );

    if (seasonFilter && seasonFilter.length > 0) {
      return programs.filter(
        (p) => p.seasonNumber && seasonFilter.includes(p.seasonNumber),
      );
    }

    return programs;
  }

  /**
   * Create a stateful iterator for a slot.
   */
  private createIterator(
    slot: SlotWithState,
    programs: ProgramWithRelationsOrm[],
  ): SlotIterator {
    const config = slot.slotConfig;
    const order = config?.order ?? 'next';
    const state = slot.state;

    const seed = state?.rngSeed ?? createEntropy();
    const useCount = state?.rngUseCount ?? 0;
    const mt = MersenneTwister19937.seedWithArray(seed).discard(useCount);
    const random = new Random(mt);

    let sortedPrograms = this.sortPrograms(
      programs,
      order,
      nullToUndefined(config?.direction),
    );

    let shuffleOrder: string[] | null = null;
    let resolvedPosition = state?.iteratorPosition ?? 0;

    if (order === 'shuffle' || order === 'ordered_shuffle') {
      if (state?.shuffleOrder && state.shuffleOrder.length > 0) {
        const storedUuidSet = new Set(state.shuffleOrder);
        const currentUuidSet = new Set(programs.map((p) => p.uuid));
        const setsAreEqual =
          storedUuidSet.size === currentUuidSet.size &&
          [...storedUuidSet].every((uuid) => currentUuidSet.has(uuid));

        if (!setsAreEqual) {
          // Program list changed — reconcile rather than doing a full reshuffle.
          // This preserves the relative order of existing programs, inserts new
          // ones after the current cursor, and correctly adjusts the position
          // index when programs before the cursor have been removed.
          const { reconciledOrder, reconciledPosition } =
            this.reconcileShuffleOrder(
              state.shuffleOrder,
              resolvedPosition,
              sortedPrograms,
              random,
            );
          shuffleOrder = reconciledOrder;
          resolvedPosition = reconciledPosition;
        } else {
          shuffleOrder = state.shuffleOrder;
        }
        sortedPrograms = this.applyShuffleOrder(sortedPrograms, shuffleOrder);
      } else {
        shuffleOrder = this.createShuffleOrder(sortedPrograms, random);
        sortedPrograms = this.applyShuffleOrder(sortedPrograms, shuffleOrder);
      }
    }

    const position = resolvedPosition % Math.max(1, sortedPrograms.length);

    return {
      position,
      programs: sortedPrograms,
      shuffleOrder,

      current(): ProgramWithRelationsOrm | null {
        if (this.programs.length === 0) return null;
        return this.programs[this.position] ?? null;
      },

      next(): void {
        if (this.programs.length === 0) return;
        this.position = (this.position + 1) % this.programs.length;
      },

      getState(): IteratorStateUpdate {
        return {
          rngSeed: seed,
          iteratorPosition: this.position,
          rngUseCount: mt.getUseCount(),
          lastScheduledAt: dayjs().toDate(),
          shuffleOrder: this.shuffleOrder,
        };
      },
    };
  }

  /**
   * Sort programs based on the specified order.
   */
  private sortPrograms(
    programs: ProgramWithRelationsOrm[],
    order: string,
    direction?: 'asc' | 'desc',
  ): ProgramWithRelationsOrm[] {
    const dir = direction === 'desc' ? -1 : 1;

    switch (order) {
      case 'next':
      case 'shuffle':
      case 'ordered_shuffle':
        return programs;

      case 'alphanumeric':
        return sortBy(programs, (p) => (dir === 1 ? p.title : -p.title.length));

      case 'chronological':
        return sortBy(programs, (p) => {
          const airDate = p.originalAirDate
            ? new Date(p.originalAirDate).getTime()
            : 0;
          const episode = (p.seasonNumber ?? 0) * 1000 + (p.episode ?? 0);
          return dir * (airDate || episode);
        });

      default:
        return programs;
    }
  }

  private createShuffleOrder(
    programs: ProgramWithRelationsOrm[],
    random: Random,
  ): string[] {
    const indices = programs.map((_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = random.integer(0, i);
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    return indices.map((i) => programs[i]!.uuid);
  }

  /**
   * Reconcile a stored shuffle order against the current program list.
   *
   * - Programs no longer in the list are silently dropped.
   * - New programs (UUIDs not in the stored order) are inserted at random
   *   positions after the current cursor so they appear in the ongoing pass.
   * - The returned position index correctly tracks where the iterator was,
   *   accounting for any items removed before the cursor.
   */
  private reconcileShuffleOrder(
    storedOrder: string[],
    storedPosition: number,
    programs: ProgramWithRelationsOrm[],
    random: Random,
  ): { reconciledOrder: string[]; reconciledPosition: number } {
    const currentUuidSet = new Set(programs.map((p) => p.uuid));

    // Keep relative order of programs still present, drop removed ones.
    const filteredOrder = storedOrder.filter((uuid) =>
      currentUuidSet.has(uuid),
    );

    // Find where the program that was at storedPosition ended up after filtering.
    const currentUuid = storedOrder[storedPosition];
    let reconciledPosition: number;
    if (isDefined(currentUuid) && currentUuidSet.has(currentUuid)) {
      reconciledPosition = filteredOrder.indexOf(currentUuid);
    } else {
      // The current program was removed; clamp to a valid index.
      reconciledPosition = Math.min(
        storedPosition,
        Math.max(0, filteredOrder.length - 1),
      );
    }

    // Insert new programs (not in stored order) at random positions after cursor.
    const storedUuidSet = new Set(storedOrder);
    const newUuids = programs
      .map((p) => p.uuid)
      .filter((uuid) => !storedUuidSet.has(uuid));

    const reconciledOrder = [...filteredOrder];
    for (const uuid of newUuids) {
      const insertStart = reconciledPosition + 1;
      const insertAt =
        insertStart >= reconciledOrder.length
          ? reconciledOrder.length // append if cursor is at/past the end
          : random.integer(insertStart, reconciledOrder.length);
      reconciledOrder.splice(insertAt, 0, uuid);
    }

    return { reconciledOrder, reconciledPosition };
  }

  private applyShuffleOrder(
    programs: ProgramWithRelationsOrm[],
    shuffleOrder: string[],
  ): ProgramWithRelationsOrm[] {
    const programMap = new Map(programs.map((p) => [p.uuid, p]));
    return seq.collect(shuffleOrder, (uuid) => programMap.get(uuid));
  }

  /**
   * Main schedule generation algorithm. Dispatches to ordered or shuffle mode.
   */
  private generateScheduleItems(
    channelUuid: string,
    schedule: InfiniteScheduleWithSlotsAndState,
    slotPrograms: SlotPrograms[],
    fromTimeMs: number,
    toTimeMs: number,
    startSequenceIndex: number,
  ): GenerationResult {
    const items: NewGeneratedScheduleItem[] = [];
    const slotStates = new Map<string, SlotStateUpdate>();

    const floatingSlots = slotPrograms.filter((sp) =>
      isNil(sp.slot.anchorTime),
    );
    const anchoredSlots = slotPrograms.filter(
      (sp) => !isNil(sp.slot.anchorTime),
    );

    const anchorEvents = this.computeAnchorEvents(
      anchoredSlots,
      fromTimeMs,
      toTimeMs,
      schedule.timeZoneOffset,
    );

    if (floatingSlots.length === 0 && anchorEvents.length === 0) {
      this.logger.warn('No floating slots or anchor events found in schedule');
      const scheduleStateUpdate: ScheduleStateUpdate = {
        floatingSlotIndex: 0,
        generationCursor: toTimeMs,
        slotSelectionSeed: null,
        slotSelectionUseCount: 0,
      };
      return { items, fromTimeMs, toTimeMs, slotStates, scheduleStateUpdate };
    }

    if (schedule.slotPlaybackOrder === 'shuffle') {
      return this.generateShuffleMode(
        channelUuid,
        schedule,
        floatingSlots,
        anchorEvents,
        items,
        slotStates,
        fromTimeMs,
        toTimeMs,
        startSequenceIndex,
      );
    }

    return this.generateOrderedMode(
      channelUuid,
      schedule,
      floatingSlots,
      anchorEvents,
      items,
      slotStates,
      fromTimeMs,
      toTimeMs,
      startSequenceIndex,
    );
  }

  /**
   * Pre-compute the UTC firing times for all anchored slots within [fromTimeMs, toTimeMs].
   * Returns events sorted chronologically.
   */
  private computeAnchorEvents(
    anchoredSlots: SlotPrograms[],
    fromTimeMs: number,
    toTimeMs: number,
    timeZoneOffsetMinutes: number,
  ): AnchorEvent[] {
    const events: AnchorEvent[] = [];
    const tzOffsetMs = timeZoneOffsetMinutes * 60 * 1000;
    const dayMs = 24 * 60 * 60 * 1000;

    // Reference UTC offset (dayjs convention: local − UTC, in minutes) used to
    // detect DST transitions.  We want the reference to equal the stored
    // timezone offset so that compensation is zero when no DST shift has
    // occurred and nonzero (±1 h) when it has.
    //
    // The stored offset in dayjs convention: stored = −timeZoneOffsetMinutes.
    // January-1 of the window year is almost always in standard (non-DST) time,
    // so startOfYear.utcOffset() serves as a fallback reference.
    //
    // Use the stored offset when the two are within 60 min of each other — this
    // means the system timezone is the same as (or very close to) the schedule's
    // timezone and DST compensation is meaningful.  If they differ by more than
    // 60 min the system is in a completely different timezone (e.g., server in
    // UTC while schedule uses EST) and we leave compensation at zero.
    //
    // Examples:
    //   EST stored (300→−300), system=NY in EDT: stored=−300, startOfYear=−300
    //     → |diff|=0≤60 → ref=−300 → comp = (−300−(−240))×60000 = −1h ✓
    //   EDT stored (240→−240), system=NY in EST: stored=−240, startOfYear=−300
    //     → |diff|=60≤60 → ref=−240 → comp = (−240−(−300))×60000 = +1h ✓
    //   EST stored (300→−300), system=UTC: stored=−300, startOfYear=0
    //     → |diff|=300>60 → ref=0 → comp = 0 (no adjustment) ✓
    const storedUtcOffset = -timeZoneOffsetMinutes;
    const startOfYearOffset = dayjs(fromTimeMs).startOf('year').utcOffset();
    const referenceUtcOffset =
      Math.abs(storedUtcOffset - startOfYearOffset) <= 60
        ? storedUtcOffset
        : startOfYearOffset;

    for (const sp of anchoredSlots) {
      const { slot } = sp;
      if (slot.anchorTime == null) continue;

      // Convention: timeZoneOffset follows Date.getTimezoneOffset() semantics:
      // offset = UTC - local (in minutes), so ET = +300, IST = -330.
      // Therefore: local = UTC - offset, and UTC = local + offset.
      const localFromMs = fromTimeMs - tzOffsetMs;
      const firstLocalDayStart = Math.floor(localFromMs / dayMs) * dayMs;

      for (
        let localDayStart = firstLocalDayStart;
        localDayStart + tzOffsetMs < toTimeMs;
        localDayStart += dayMs
      ) {
        // Compute the candidate UTC firing time using the stored (fixed) offset.
        const naiveUtcFiringTime = localDayStart + tzOffsetMs + slot.anchorTime;

        // DST compensation: if the actual system UTC offset at the naive
        // firing time differs from the reference (stored offset), the fixed
        // stored offset was stale for this day.
        //
        // dayjs utcOffset() is local − UTC (opposite sign to getTimezoneOffset).
        const actualUtcOffset = dayjs(naiveUtcFiringTime).utcOffset();
        const dstCompensationMs =
          (referenceUtcOffset - actualUtcOffset) * 60 * 1000;
        const utcFiringTime = naiveUtcFiringTime + dstCompensationMs;

        if (utcFiringTime >= toTimeMs) break;
        if (utcFiringTime < fromTimeMs) continue;

        // Check day-of-week restriction (0=Sunday, 6=Saturday in local time)
        if (slot.anchorDays && slot.anchorDays.length > 0) {
          // TODO: check if we should use localized dayjs here to get the day
          // since 0 might mean Sunday for some and Monday for others.
          const dayOfWeek = new Date(localDayStart).getUTCDay();
          if (!slot.anchorDays.includes(dayOfWeek)) continue;
        }

        events.push({ timeMs: utcFiringTime, slotPrograms: sp });
      }
    }

    return sortBy(events, (e) => e.timeMs);
  }

  /**
   * Ordered mode: cycle through floating slots in order, respecting fill mode.
   * Anchored slots fire at their scheduled times and interrupt the floating rotation.
   */
  private generateOrderedMode(
    channelUuid: string,
    schedule: InfiniteScheduleWithSlotsAndState,
    floatingSlots: SlotPrograms[],
    anchorEvents: AnchorEvent[],
    items: NewGeneratedScheduleItem[],
    slotStates: Map<string, SlotStateUpdate>,
    fromTimeMs: number,
    toTimeMs: number,
    startSequenceIndex: number,
  ): GenerationResult {
    let floatingSlotIndex = schedule.state?.floatingSlotIndex ?? 0;
    let currentTimeMs = fromTimeMs;
    let sequenceIndex = startSequenceIndex;
    let anchorEventIndex = 0;
    const hasAnchors = anchorEvents.length > 0;

    // Initialize fill progress from persisted slot state
    const fillProgress = new Map<string, { count: number; durationMs: number }>(
      floatingSlots.map((sp) => [
        sp.slot.uuid,
        {
          count: sp.slot.state?.fillModeCount ?? 0,
          durationMs: sp.slot.state?.fillModeDurationMs ?? 0,
        },
      ]),
    );

    const pushOrExtendFlex = (
      currSlotId: Nullable<string>,
      newDurationMs: number,
    ) => {
      const lastItem = items[items.length - 1];
      if (lastItem?.itemType === 'flex') {
        lastItem.durationMs += newDurationMs;
        return;
      }
      items.push(
        this.createFlexItem(
          channelUuid,
          schedule.uuid,
          currSlotId,
          currentTimeMs,
          newDurationMs,
          sequenceIndex++,
        ),
      );
    };

    // Snap the initial cursor to the next padToMultiple boundary so the first
    // program also starts on a grid-aligned time.
    if (schedule.padToMultiple > 1 && currentTimeMs % schedule.padToMultiple !== 0) {
      const alignedStart =
        Math.ceil(currentTimeMs / schedule.padToMultiple) *
        schedule.padToMultiple;
      pushOrExtendFlex(null, alignedStart - currentTimeMs);
      currentTimeMs = alignedStart;
    }

    while (currentTimeMs < toTimeMs) {
      // 1. Fire any anchor events that are now due (currentTimeMs >= anchor.timeMs)
      while (anchorEventIndex < anchorEvents.length) {
        const nextAnchor = anchorEvents[anchorEventIndex];
        if (!nextAnchor || currentTimeMs < nextAnchor.timeMs) break;

        const { slot: ancSlot, iterator: ancIterator } =
          nextAnchor.slotPrograms;
        const ancFillValue = ancSlot.fillValue ?? 1;
        let ancEmitted = 0;
        let ancDurationMs = 0;

        while (currentTimeMs < toTimeMs) {
          const shouldStop = (() => {
            switch (ancSlot.fillMode) {
              case 'fill':
                return ancEmitted > 0; // anchored fill = emit exactly one, then stop
              case 'count':
                return ancEmitted >= ancFillValue;
              case 'duration':
                return ancDurationMs >= ancFillValue;
            }
          })();
          if (shouldStop) break;

          const program = ancIterator.current();
          if (!program) break;

          const ancProgramDuration = program.duration;
          items.push(
            this.createContentItem(
              channelUuid,
              schedule.uuid,
              ancSlot,
              program,
              currentTimeMs,
              ancProgramDuration,
              sequenceIndex++,
            ),
          );
          currentTimeMs += ancProgramDuration;

          // Padding flex for anchored slot
          const effectivePadToMultiple =
            ancSlot.padToMultiple ?? schedule.padToMultiple;
          let ancFlexAmount = 0;
          if (effectivePadToMultiple > 1) {
            const ancRawEndMs = currentTimeMs;
            ancFlexAmount =
              Math.ceil(ancRawEndMs / effectivePadToMultiple) *
                effectivePadToMultiple -
              ancRawEndMs;
          } else if (ancSlot.padMs && ancSlot.padMs > 0) {
            ancFlexAmount = ancSlot.padMs;
          }
          if (ancFlexAmount > 0) {
            pushOrExtendFlex(ancSlot.uuid, ancFlexAmount);
            currentTimeMs += ancFlexAmount;
          }

          ancEmitted++;
          ancDurationMs += ancProgramDuration;
          ancIterator.next();
        }

        slotStates.set(ancSlot.uuid, {
          ...ancIterator.getState(),
          fillModeCount: 0,
          fillModeDurationMs: 0,
          fillerState: null,
        });

        anchorEventIndex++;
      }

      if (currentTimeMs >= toTimeMs) break;

      // 2. If there are no floating slots, advance to the next anchor event with flex
      if (floatingSlots.length === 0) {
        const nextAnchor = anchorEvents[anchorEventIndex];
        if (nextAnchor) {
          const gapMs = nextAnchor.timeMs - currentTimeMs;
          if (gapMs > 0) {
            pushOrExtendFlex(null, gapMs);
            currentTimeMs = nextAnchor.timeMs;
          }
        } else {
          // No more anchors — fill to end
          pushOrExtendFlex(null, toTimeMs - currentTimeMs);
          currentTimeMs = toTimeMs;
        }
        continue;
      }

      // 3. Process current floating slot
      // The fill boundary is the next anchor time (or toTimeMs if no more anchors)
      const nextAnchor = anchorEvents[anchorEventIndex];
      const fillUntil = nextAnchor
        ? Math.min(nextAnchor.timeMs, toTimeMs)
        : toTimeMs;

      const idx = floatingSlotIndex % floatingSlots.length;
      const currentSlotProg = floatingSlots[idx]!;
      const { slot, iterator, fillerHelper } = currentSlotProg;

      // Special slot types: redirect and flex rotate immediately
      if (slot.slotType === 'redirect') {
        const dur = Math.max(schedule.padToMultiple, 1);
        if (currentTimeMs + dur <= fillUntil) {
          items.push(
            this.createRedirectItem(
              channelUuid,
              schedule.uuid,
              slot,
              currentTimeMs,
              dur,
              sequenceIndex++,
            ),
          );
          currentTimeMs += dur;
        } else {
          // Not enough room before the boundary — emit flex to fill the gap
          const gapMs = fillUntil - currentTimeMs;
          if (gapMs > 0) {
            pushOrExtendFlex(null, gapMs);
            currentTimeMs = fillUntil;
          }
        }
        floatingSlotIndex++;
        continue;
      }

      if (slot.slotType === 'flex') {
        const dur = Math.max(schedule.padToMultiple, 1);
        if (currentTimeMs + dur <= fillUntil) {
          pushOrExtendFlex(slot.uuid, dur);
          currentTimeMs += dur;
        } else {
          currentTimeMs = fillUntil;
        }
        floatingSlotIndex++;
        continue;
      }

      const program = iterator.current();
      if (!program) {
        // No programs — try fallback filler, then flex to the fill boundary
        if (fillerHelper && fillerHelper.hasType('fallback')) {
          while (currentTimeMs < fillUntil) {
            const sel = fillerHelper.select(
              'fallback',
              fillUntil - currentTimeMs,
              currentTimeMs,
            );
            if (!sel) break;
            items.push(
              this.createFillerItem(
                channelUuid,
                schedule.uuid,
                slot.uuid,
                sel.program,
                'fallback',
                sel.fillerListId,
                currentTimeMs,
                sel.program.duration,
                sequenceIndex++,
              ),
            );
            currentTimeMs += sel.program.duration;
          }
        }

        const gapMs = fillUntil - currentTimeMs;
        if (gapMs > 0) {
          pushOrExtendFlex(null, gapMs);
          currentTimeMs = fillUntil;
        }
        floatingSlotIndex++;
        continue;
      }

      const programDuration = program.duration;
      const progress = fillProgress.get(slot.uuid)!;
      const isFirstInRun = progress.count === 0 && progress.durationMs === 0;

      // For fill mode: if this program would overshoot the next anchor, handle
      // based on anchorMode:
      //   hard (default): bridge gap with flex and fire anchor at scheduled time
      //   soft: let the program run; the anchor fires late on the next iteration
      //   padded: fill the gap with the anchor slot's filler, then flex for any remainder
      if (
        slot.fillMode === 'fill' &&
        hasAnchors &&
        nextAnchor &&
        currentTimeMs + programDuration > nextAnchor.timeMs &&
        nextAnchor.slotPrograms.slot.anchorMode !== 'soft'
      ) {
        if (nextAnchor.slotPrograms.slot.anchorMode === 'padded') {
          const r = this.fillPaddedAnchorGap(
            channelUuid,
            schedule.uuid,
            nextAnchor.slotPrograms,
            currentTimeMs,
            nextAnchor.timeMs,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs = r.endTimeMs;
          sequenceIndex = r.nextSeqIndex;
        }
        if (currentTimeMs < nextAnchor.timeMs) {
          pushOrExtendFlex(slot.uuid, nextAnchor.timeMs - currentTimeMs);
          currentTimeMs = nextAnchor.timeMs;
        }
        floatingSlotIndex++;
        continue;
      }

      // Compute padding flex amount (for time-grid alignment).
      // Use (currentTimeMs + programDuration) as the raw end so the snapped
      // boundary is time-relative, not just duration-relative.  Pre-content
      // filler steals from flexBudget, so its duration cancels and the slot
      // still ends on a multiple of effectivePadToMultiple.
      const effectivePadToMultiple =
        slot.padToMultiple ?? schedule.padToMultiple;
      let flexBudget = 0;
      if (effectivePadToMultiple > 1) {
        const rawEndMs = currentTimeMs + programDuration;
        flexBudget =
          Math.ceil(rawEndMs / effectivePadToMultiple) *
            effectivePadToMultiple -
          rawEndMs;
      } else if (slot.padMs && slot.padMs > 0) {
        flexBudget = slot.padMs;
      }

      // ── Pre-content filler injection ──────────────────────────────────────

      // (1/2) Head — fires once before the first content item in a run
      if (fillerHelper && isFirstInRun) {
        const pm = fillerHelper.getPlaybackMode('head');
        if (pm) {
          const isRelaxed = pm.type === 'relaxed';
          if (!isRelaxed || flexBudget > 0) {
            const r = fillerHelper.emitFillerItems(
              'head',
              channelUuid,
              schedule.uuid,
              slot.uuid,
              currentTimeMs,
              pm,
              flexBudget,
              sequenceIndex,
            );
            items.push(...r.items);
            currentTimeMs += r.timeConsumedMs;
            if (isRelaxed) flexBudget -= r.timeConsumedMs;
            sequenceIndex = r.nextSeqIndex;
          }
        }
      }

      // (3/4) Pre — fires before each content item
      if (fillerHelper) {
        const pm = fillerHelper.getPlaybackMode('pre');
        if (pm) {
          const isRelaxed = pm.type === 'relaxed';
          if (!isRelaxed || flexBudget > 0) {
            const r = fillerHelper.emitFillerItems(
              'pre',
              channelUuid,
              schedule.uuid,
              slot.uuid,
              currentTimeMs,
              pm,
              flexBudget,
              sequenceIndex,
            );
            items.push(...r.items);
            currentTimeMs += r.timeConsumedMs;
            if (isRelaxed) flexBudget -= r.timeConsumedMs;
            sequenceIndex = r.nextSeqIndex;
          }
        }
      }

      // (5) Emit the content item
      items.push(
        this.createContentItem(
          channelUuid,
          schedule.uuid,
          slot,
          program,
          currentTimeMs,
          programDuration,
          sequenceIndex++,
        ),
      );
      currentTimeMs += programDuration;

      // Update fill progress and advance iterator
      progress.count++;
      progress.durationMs += programDuration;
      iterator.next();

      // Determine if we should rotate to the next slot
      let shouldRotate = false;
      switch (slot.fillMode) {
        case 'fill':
          shouldRotate = !hasAnchors || currentTimeMs >= fillUntil;
          break;
        case 'count':
          shouldRotate = progress.count >= (slot.fillValue ?? 1);
          break;
        case 'duration':
          shouldRotate = progress.durationMs >= (slot.fillValue ?? 0);
          break;
      }

      const isLastInRun = shouldRotate;

      // ── Post-content filler injection (relaxed — consume from flex budget) ─

      // (7) Post (relaxed)
      if (fillerHelper && flexBudget > 0) {
        const pm = fillerHelper.getPlaybackMode('post');
        if (pm?.type === 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'post',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            flexBudget,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          flexBudget -= r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // (8) Tail (relaxed) — fires within flex budget after the last content item
      if (fillerHelper && isLastInRun && flexBudget > 0) {
        const pm = fillerHelper.getPlaybackMode('tail');
        if (pm?.type === 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'tail',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            flexBudget,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          flexBudget -= r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // (9) Fallback filler within remaining flex budget
      if (fillerHelper && flexBudget > 0) {
        while (flexBudget > 0) {
          const sel = fillerHelper.select(
            'fallback',
            flexBudget,
            currentTimeMs,
          );
          if (!sel) break;
          items.push(
            this.createFillerItem(
              channelUuid,
              schedule.uuid,
              slot.uuid,
              sel.program,
              'fallback',
              sel.fillerListId,
              currentTimeMs,
              sel.program.duration,
              sequenceIndex++,
            ),
          );
          currentTimeMs += sel.program.duration;
          flexBudget -= sel.program.duration;
        }
      }

      // (10) Emit remaining flex (padding that wasn't consumed by relaxed filler)
      if (flexBudget > 0) {
        pushOrExtendFlex(slot.uuid, flexBudget);
        currentTimeMs += flexBudget;
      }

      // ── Post-content filler injection (non-relaxed — unconditionally advances time) ─

      // (11) Post (non-relaxed)
      if (fillerHelper) {
        const pm = fillerHelper.getPlaybackMode('post');
        if (pm && pm.type !== 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'post',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            0,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // (12) Tail (non-relaxed) — fires unconditionally after the last content item
      if (fillerHelper && isLastInRun) {
        const pm = fillerHelper.getPlaybackMode('tail');
        if (pm && pm.type !== 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'tail',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            0,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // Save slot state with current fill progress
      slotStates.set(slot.uuid, {
        ...iterator.getState(),
        fillModeCount: shouldRotate ? 0 : progress.count,
        fillModeDurationMs: shouldRotate ? 0 : progress.durationMs,
        fillerState: fillerHelper?.getState() ?? null,
      });

      if (shouldRotate) {
        progress.count = 0;
        progress.durationMs = 0;
        floatingSlotIndex++;
      }
    }

    const scheduleStateUpdate: ScheduleStateUpdate = {
      floatingSlotIndex,
      generationCursor: currentTimeMs,
      slotSelectionSeed: null,
      slotSelectionUseCount: 0,
    };

    return { items, fromTimeMs, toTimeMs, slotStates, scheduleStateUpdate };
  }

  /**
   * Shuffle mode: pick slots using weighted random selection, always distribute flex.
   */
  private generateShuffleMode(
    channelUuid: string,
    schedule: InfiniteScheduleWithSlotsAndState,
    floatingSlots: SlotPrograms[],
    anchorEvents: AnchorEvent[],
    items: NewGeneratedScheduleItem[],
    slotStates: Map<string, SlotStateUpdate>,
    fromTimeMs: number,
    toTimeMs: number,
    startSequenceIndex: number,
  ): GenerationResult {
    const totalWeight = sumBy(floatingSlots, (sp) => sp.slot.weight);

    const schedState = schedule.state;
    const selectionSeed = schedState?.slotSelectionSeed ?? createEntropy();
    const selectionUseCount = schedState?.slotSelectionUseCount ?? 0;
    const selectionMt =
      MersenneTwister19937.seedWithArray(selectionSeed).discard(
        selectionUseCount,
      );
    const selectionRandom = new Random(selectionMt);

    let currentTimeMs = fromTimeMs;
    let sequenceIndex = startSequenceIndex;

    const pushOrExtendFlex = (
      currSlotId: Nullable<string>,
      newDurationMs: number,
    ) => {
      const lastItem = items[items.length - 1];
      if (lastItem?.itemType === 'flex') {
        lastItem.durationMs += newDurationMs;
        return;
      }
      items.push(
        this.createFlexItem(
          channelUuid,
          schedule.uuid,
          currSlotId,
          currentTimeMs,
          newDurationMs,
          sequenceIndex++,
        ),
      );
    };

    let anchorEventIndex = 0;

    // Snap the initial cursor to the next padToMultiple boundary so the first
    // program also starts on a grid-aligned time.
    if (schedule.padToMultiple > 1 && currentTimeMs % schedule.padToMultiple !== 0) {
      const alignedStart =
        Math.ceil(currentTimeMs / schedule.padToMultiple) *
        schedule.padToMultiple;
      pushOrExtendFlex(null, alignedStart - currentTimeMs);
      currentTimeMs = alignedStart;
    }

    while (currentTimeMs < toTimeMs) {
      // 1. Fire any anchor events that are now due.
      while (anchorEventIndex < anchorEvents.length) {
        const nextAnchor = anchorEvents[anchorEventIndex];
        if (!nextAnchor || currentTimeMs < nextAnchor.timeMs) break;

        const { slot: ancSlot, iterator: ancIterator } =
          nextAnchor.slotPrograms;
        const ancFillValue = ancSlot.fillValue ?? 1;
        let ancEmitted = 0;
        let ancDurationMs = 0;

        while (currentTimeMs < toTimeMs) {
          const shouldStop = (() => {
            switch (ancSlot.fillMode) {
              case 'fill':
                return ancEmitted > 0; // anchored fill = emit exactly one, then stop
              case 'count':
                return ancEmitted >= ancFillValue;
              case 'duration':
                return ancDurationMs >= ancFillValue;
            }
          })();
          if (shouldStop) break;

          const ancProgram = ancIterator.current();
          if (!ancProgram) break;

          const ancProgramDuration = ancProgram.duration;
          items.push(
            this.createContentItem(
              channelUuid,
              schedule.uuid,
              ancSlot,
              ancProgram,
              currentTimeMs,
              ancProgramDuration,
              sequenceIndex++,
            ),
          );
          currentTimeMs += ancProgramDuration;

          const ancEffectivePad =
            ancSlot.padToMultiple ?? schedule.padToMultiple;
          let ancFlexAmount = 0;
          if (ancEffectivePad > 1) {
            // currentTimeMs is already past the anchor program at this point
            const ancRawEndMs = currentTimeMs;
            ancFlexAmount =
              Math.ceil(ancRawEndMs / ancEffectivePad) * ancEffectivePad -
              ancRawEndMs;
          } else if (ancSlot.padMs && ancSlot.padMs > 0) {
            ancFlexAmount = ancSlot.padMs;
          }
          if (ancFlexAmount > 0) {
            pushOrExtendFlex(ancSlot.uuid, ancFlexAmount);
            currentTimeMs += ancFlexAmount;
          }

          ancEmitted++;
          ancDurationMs += ancProgramDuration;
          ancIterator.next();
        }

        slotStates.set(ancSlot.uuid, {
          ...ancIterator.getState(),
          fillModeCount: 0,
          fillModeDurationMs: 0,
          fillerState: null,
        });

        anchorEventIndex++;
      }

      if (currentTimeMs >= toTimeMs) break;

      // 2. If there are no floating slots, advance to the next anchor with flex.
      if (floatingSlots.length === 0) {
        const nextAnchor = anchorEvents[anchorEventIndex];
        if (nextAnchor) {
          const gapMs = nextAnchor.timeMs - currentTimeMs;
          if (gapMs > 0) {
            pushOrExtendFlex(null, gapMs);
            currentTimeMs = nextAnchor.timeMs;
          }
        } else {
          pushOrExtendFlex(null, toTimeMs - currentTimeMs);
          currentTimeMs = toTimeMs;
        }
        continue;
      }

      // 3. Determine the fill boundary: the next anchor time (or end of window).
      const nextAnchorForFloat = anchorEvents[anchorEventIndex];
      const fillUntil = nextAnchorForFloat
        ? Math.min(nextAnchorForFloat.timeMs, toTimeMs)
        : toTimeMs;

      const selected = this.selectSlotWeightedRng(
        floatingSlots,
        totalWeight,
        selectionRandom,
      );

      if (!selected) break;

      const { slot, iterator, fillerHelper } = selected;

      if (slot.slotType === 'redirect') {
        const dur = Math.max(schedule.padToMultiple, 1);
        if (currentTimeMs + dur <= fillUntil) {
          items.push(
            this.createRedirectItem(
              channelUuid,
              schedule.uuid,
              slot,
              currentTimeMs,
              dur,
              sequenceIndex++,
            ),
          );
          currentTimeMs += dur;
        } else {
          currentTimeMs = fillUntil;
        }
        continue;
      }

      if (slot.slotType === 'flex') {
        const dur = Math.max(schedule.padToMultiple, 1);
        if (currentTimeMs + dur <= fillUntil) {
          pushOrExtendFlex(slot.uuid, dur);
          currentTimeMs += dur;
        } else {
          currentTimeMs = fillUntil;
        }
        continue;
      }

      const program = iterator.current();
      if (!program) {
        // No content — try fallback filler, then a small flex unit
        if (fillerHelper && fillerHelper.hasType('fallback')) {
          const sel = fillerHelper.select(
            'fallback',
            fillUntil - currentTimeMs,
            currentTimeMs,
          );
          if (sel) {
            items.push(
              this.createFillerItem(
                channelUuid,
                schedule.uuid,
                slot.uuid,
                sel.program,
                'fallback',
                sel.fillerListId,
                currentTimeMs,
                sel.program.duration,
                sequenceIndex++,
              ),
            );
            currentTimeMs += sel.program.duration;
            continue;
          }
        }
        const dur = Math.max(schedule.padToMultiple, 1);
        pushOrExtendFlex(null, dur);
        currentTimeMs += dur;
        continue;
      }

      const programDuration = program.duration;

      // If this program would overshoot the next anchor, handle based on anchorMode
      // (same semantics as ordered mode; soft lets the program run).
      if (
        nextAnchorForFloat &&
        currentTimeMs + programDuration > nextAnchorForFloat.timeMs &&
        nextAnchorForFloat.slotPrograms.slot.anchorMode !== 'soft'
      ) {
        if (nextAnchorForFloat.slotPrograms.slot.anchorMode === 'padded') {
          const r = this.fillPaddedAnchorGap(
            channelUuid,
            schedule.uuid,
            nextAnchorForFloat.slotPrograms,
            currentTimeMs,
            nextAnchorForFloat.timeMs,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs = r.endTimeMs;
          sequenceIndex = r.nextSeqIndex;
        }
        if (currentTimeMs < nextAnchorForFloat.timeMs) {
          pushOrExtendFlex(
            slot.uuid,
            nextAnchorForFloat.timeMs - currentTimeMs,
          );
          currentTimeMs = nextAnchorForFloat.timeMs;
        }
        continue;
      }

      // In shuffle mode every selected program is its own mini-run, so
      // isFirstInRun = true and isLastInRun = true for every program.
      const isFirstInRun = true;
      const isLastInRun = true;

      // Always distribute flex in shuffle mode
      const effectivePadToMultiple =
        slot.padToMultiple ?? schedule.padToMultiple;
      let flexBudget = 0;
      if (effectivePadToMultiple > 0) {
        const rawEndMs = currentTimeMs + programDuration;
        flexBudget =
          Math.ceil(rawEndMs / effectivePadToMultiple) *
            effectivePadToMultiple -
          rawEndMs;
      } else if (slot.padMs && slot.padMs > 0) {
        flexBudget = slot.padMs;
      }

      // ── Pre-content filler (shuffle mode: head/pre fire around every program) ─

      // (1/2) Head
      if (fillerHelper && isFirstInRun) {
        const pm = fillerHelper.getPlaybackMode('head');
        if (pm) {
          const isRelaxed = pm.type === 'relaxed';
          if (!isRelaxed || flexBudget > 0) {
            const r = fillerHelper.emitFillerItems(
              'head',
              channelUuid,
              schedule.uuid,
              slot.uuid,
              currentTimeMs,
              pm,
              flexBudget,
              sequenceIndex,
            );
            items.push(...r.items);
            currentTimeMs += r.timeConsumedMs;
            if (isRelaxed) flexBudget -= r.timeConsumedMs;
            sequenceIndex = r.nextSeqIndex;
          }
        }
      }

      // (3/4) Pre
      if (fillerHelper) {
        const pm = fillerHelper.getPlaybackMode('pre');
        if (pm) {
          const isRelaxed = pm.type === 'relaxed';
          if (!isRelaxed || flexBudget > 0) {
            const r = fillerHelper.emitFillerItems(
              'pre',
              channelUuid,
              schedule.uuid,
              slot.uuid,
              currentTimeMs,
              pm,
              flexBudget,
              sequenceIndex,
            );
            items.push(...r.items);
            currentTimeMs += r.timeConsumedMs;
            if (isRelaxed) flexBudget -= r.timeConsumedMs;
            sequenceIndex = r.nextSeqIndex;
          }
        }
      }

      // (5) Content item
      items.push(
        this.createContentItem(
          channelUuid,
          schedule.uuid,
          slot,
          program,
          currentTimeMs,
          programDuration,
          sequenceIndex++,
        ),
      );
      currentTimeMs += programDuration;

      iterator.next();

      // (7) Post (relaxed)
      if (fillerHelper && flexBudget > 0) {
        const pm = fillerHelper.getPlaybackMode('post');
        if (pm?.type === 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'post',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            flexBudget,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          flexBudget -= r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // (8) Tail (relaxed)
      if (fillerHelper && isLastInRun && flexBudget > 0) {
        const pm = fillerHelper.getPlaybackMode('tail');
        if (pm?.type === 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'tail',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            flexBudget,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          flexBudget -= r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // (9) Fallback within remaining flex
      if (fillerHelper && flexBudget > 0) {
        while (flexBudget > 0) {
          const sel = fillerHelper.select(
            'fallback',
            flexBudget,
            currentTimeMs,
          );
          if (!sel) break;
          items.push(
            this.createFillerItem(
              channelUuid,
              schedule.uuid,
              slot.uuid,
              sel.program,
              'fallback',
              sel.fillerListId,
              currentTimeMs,
              sel.program.duration,
              sequenceIndex++,
            ),
          );
          currentTimeMs += sel.program.duration;
          flexBudget -= sel.program.duration;
        }
      }

      // (10) Remaining flex
      if (flexBudget > 0) {
        pushOrExtendFlex(slot.uuid, flexBudget);
        currentTimeMs += flexBudget;
      }

      // (11) Post (non-relaxed)
      if (fillerHelper) {
        const pm = fillerHelper.getPlaybackMode('post');
        if (pm && pm.type !== 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'post',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            0,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      // (12) Tail (non-relaxed)
      if (fillerHelper && isLastInRun) {
        const pm = fillerHelper.getPlaybackMode('tail');
        if (pm && pm.type !== 'relaxed') {
          const r = fillerHelper.emitFillerItems(
            'tail',
            channelUuid,
            schedule.uuid,
            slot.uuid,
            currentTimeMs,
            pm,
            0,
            sequenceIndex,
          );
          items.push(...r.items);
          currentTimeMs += r.timeConsumedMs;
          sequenceIndex = r.nextSeqIndex;
        }
      }

      slotStates.set(slot.uuid, {
        ...iterator.getState(),
        fillModeCount: 0,
        fillModeDurationMs: 0,
        fillerState: fillerHelper?.getState() ?? null,
      });
    }

    const scheduleStateUpdate: ScheduleStateUpdate = {
      floatingSlotIndex: 0,
      generationCursor: currentTimeMs,
      slotSelectionSeed: selectionSeed,
      slotSelectionUseCount: selectionMt.getUseCount(),
    };

    return { items, fromTimeMs, toTimeMs, slotStates, scheduleStateUpdate };
  }

  /**
   * Weighted random slot selection using a seeded RNG.
   */
  private selectSlotWeightedRng(
    slots: SlotPrograms[],
    totalWeight: number,
    random: Random,
  ): SlotPrograms | null {
    if (slots.length === 0) return null;
    if (slots.length === 1) return slots[0]!;

    const roll = random.real(0, totalWeight, false);
    let cumulative = 0;
    for (const slotProg of slots) {
      cumulative += slotProg.slot.weight;
      if (roll < cumulative) return slotProg;
    }
    return slots[slots.length - 1]!;
  }

  private createContentItem(
    channelUuid: string,
    scheduleUuid: string,
    slot: InfiniteScheduleSlot,
    program: ProgramWithRelationsOrm,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
      channelUuid,
      scheduleUuid,
      programUuid: program.uuid,
      slotUuid: slot.uuid,
      itemType: 'content' as GeneratedItemType,
      startTimeMs,
      durationMs,
      redirectChannelUuid: null,
      fillerListId: null,
      fillerType: null,
      sequenceIndex,
      createdAt: +dayjs(),
    };
  }

  /**
   * For 'padded' anchor mode: attempt to fill the gap before the anchor fires
   * using the anchor slot's filler configuration (head → pre → fallback in
   * priority order). Any gap that filler cannot cover is left to the caller to
   * close with flex.
   */
  private fillPaddedAnchorGap(
    channelUuid: string,
    scheduleUuid: string,
    anchorSlotPrograms: SlotPrograms,
    startTimeMs: number,
    anchorTimeMs: number,
    startSequenceIndex: number,
  ): {
    items: NewGeneratedScheduleItem[];
    endTimeMs: number;
    nextSeqIndex: number;
  } {
    const { slot, fillerHelper } = anchorSlotPrograms;
    const fillerItems: NewGeneratedScheduleItem[] = [];
    let currentTimeMs = startTimeMs;
    let sequenceIndex = startSequenceIndex;

    if (fillerHelper) {
      for (const fType of ['head', 'pre', 'fallback'] as const) {
        if (!fillerHelper.hasType(fType)) continue;
        while (currentTimeMs < anchorTimeMs) {
          const sel = fillerHelper.select(
            fType,
            anchorTimeMs - currentTimeMs,
            currentTimeMs,
          );
          if (!sel) break;
          fillerItems.push(
            this.createFillerItem(
              channelUuid,
              scheduleUuid,
              slot.uuid,
              sel.program,
              fType,
              sel.fillerListId,
              currentTimeMs,
              sel.program.duration,
              sequenceIndex++,
            ),
          );
          currentTimeMs += sel.program.duration;
        }
        if (currentTimeMs >= anchorTimeMs) break;
      }
    }

    return {
      items: fillerItems,
      endTimeMs: currentTimeMs,
      nextSeqIndex: sequenceIndex,
    };
  }

  private createFillerItem(
    channelUuid: string,
    scheduleUuid: string,
    slotUuid: string,
    program: ProgramWithRelationsOrm,
    fillerType: SlotFillerTypes,
    fillerListId: string,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
      channelUuid,
      scheduleUuid,
      programUuid: program.uuid,
      slotUuid,
      itemType: 'filler' as GeneratedItemType,
      startTimeMs,
      durationMs,
      redirectChannelUuid: null,
      fillerListId,
      fillerType,
      sequenceIndex,
      createdAt: +dayjs(),
    };
  }

  private createFlexItem(
    channelUuid: string,
    scheduleUuid: string,
    slotUuid: string | null,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
      channelUuid,
      scheduleUuid,
      programUuid: null,
      slotUuid,
      itemType: 'flex' as GeneratedItemType,
      startTimeMs,
      durationMs,
      redirectChannelUuid: null,
      fillerListId: null,
      fillerType: null,
      sequenceIndex,
      createdAt: +dayjs(),
    };
  }

  private createRedirectItem(
    channelUuid: string,
    scheduleUuid: string,
    slot: InfiniteScheduleSlot,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
      channelUuid,
      scheduleUuid,
      programUuid: null,
      slotUuid: slot.uuid,
      itemType: 'redirect' as GeneratedItemType,
      startTimeMs,
      durationMs,
      redirectChannelUuid: slot.redirectChannelId,
      fillerListId: null,
      fillerType: null,
      sequenceIndex,
      createdAt: +dayjs(),
    };
  }
}
