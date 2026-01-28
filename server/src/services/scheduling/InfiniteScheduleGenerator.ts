import { InfiniteScheduleDB } from '@/db/InfiniteScheduleDB.js';
import { ProgramDB } from '@/db/ProgramDB.js';
import type { ProgramWithRelationsOrm } from '@/db/schema/derivedTypes.js';
import type {
  GeneratedItemType,
  NewGeneratedScheduleItem,
} from '@/db/schema/GeneratedScheduleItem.js';
import type { InfiniteSchedule } from '@/db/schema/InfiniteSchedule.js';
import type {
  InfiniteScheduleSlot,
  InfiniteSlotConfig,
} from '@/db/schema/InfiniteScheduleSlot.js';
import type { InfiniteScheduleSlotState } from '@/db/schema/InfiniteScheduleSlotState.js';
import { KEYS } from '@/types/inject.js';
import dayjs from '@/util/dayjs.js';
import { inject, injectable } from 'inversify';
import { isNil, sortBy, sumBy } from 'lodash-es';
import { createEntropy, MersenneTwister19937, Random } from 'random-js';
import { v4 } from 'uuid';
import { CustomShowDB } from '../../db/CustomShowDB.js';
import { FillerDB } from '../../db/FillerListDB.js';
import type { Logger } from '../../util/logging/LoggerFactory.js';

export interface GenerationResult {
  items: NewGeneratedScheduleItem[];
  fromTimeMs: number;
  toTimeMs: number;
  slotStates: Map<string, SlotStateUpdate>;
}

export interface SlotStateUpdate {
  iteratorPosition: number;
  rngUseCount: number;
  lastScheduledAt: Date;
  shuffleOrder?: string[] | null;
}

type SlotWithState = InfiniteScheduleSlot & {
  state: InfiniteScheduleSlotState | null;
};

type InfiniteScheduleWithSlotsAndState = InfiniteSchedule & {
  slots: SlotWithState[];
};

interface SlotPrograms {
  slot: SlotWithState;
  programs: ProgramWithRelationsOrm[];
  iterator: SlotIterator;
}

interface SlotIterator {
  position: number;
  programs: ProgramWithRelationsOrm[];
  shuffleOrder: string[] | null;
  random: Random;
  useCount: number;

  current(): ProgramWithRelationsOrm | null;
  next(): void;
  getState(): SlotStateUpdate;
}

@injectable()
export class InfiniteScheduleGenerator {
  constructor(
    @inject(KEYS.Logger) private logger: Logger,
    @inject(KEYS.InfiniteScheduleDB)
    private infiniteScheduleDB: InfiniteScheduleDB,
    @inject(KEYS.ProgramDB) private programDB: ProgramDB,
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
    @inject(FillerDB) private fillerDB: FillerDB,
  ) {}

  /**
   * Generate schedule items for a given schedule.
   * This is the main entry point for schedule generation.
   */
  async generate(
    scheduleUuid: string,
    fromTimeMs?: number,
    toTimeMs?: number,
  ): Promise<GenerationResult> {
    const schedule =
      await this.infiniteScheduleDB.getScheduleWithState(scheduleUuid);
    if (!schedule) {
      throw new Error(`Schedule ${scheduleUuid} not found`);
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

    // Collect programs for each slot
    const slotPrograms = await this.collectSlotPrograms(schedule);

    // Generate the schedule
    return this.generateScheduleItems(schedule, slotPrograms, from, to);
  }

  /**
   * Preview schedule generation without persisting.
   */
  async preview(
    schedule: Omit<InfiniteScheduleWithSlotsAndState, 'uuid'>,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<GenerationResult> {
    // Create a temporary schedule object with UUID for generation
    const scheduleWithUuid: InfiniteScheduleWithSlotsAndState = {
      ...schedule,
      uuid: v4(),
      slots: schedule.slots.map((slot) => ({
        ...slot,
        uuid: slot.uuid ?? v4(),
        state: null,
      })),
    };

    const slotPrograms = await this.collectSlotPrograms(scheduleWithUuid);
    return this.generateScheduleItems(
      scheduleWithUuid,
      slotPrograms,
      fromTimeMs,
      toTimeMs,
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
      results.push({ slot, programs, iterator });
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
          (slot.slotConfig as InfiniteSlotConfig)?.seasonFilter,
        );

      case 'custom-show':
        if (!slot.customShowId) return [];
        return this.customShowDB.getShowProgramsOrm(slot.customShowId);

      case 'filler':
        if (!slot.fillerListId) return [];
        return this.fillerDB.getFillerProgramsOrm(slot.fillerListId);

      case 'smart-collection':
        if (!slot.smartCollectionId) return [];
        // Smart collections return search documents, not programs
        // Need to convert - for Phase 1, we return empty (will be enhanced later)
        // TODO: Implement smart collection program retrieval
        return [];

      case 'movie':
        // For movie slots, programs would come from channel's program pool
        // For now, return empty - this would be enhanced in Phase 2
        return [];

      case 'redirect':
      case 'flex':
        // These don't have programs
        return [];

      default:
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
    const programs = await this.programDB.getProgramGroupingDescendants(
      showId,
      'show',
    );

    if (seasonFilter && seasonFilter.length > 0) {
      return programs.filter(
        (p) => p.seasonNumber && seasonFilter.includes(p.seasonNumber),
      );
    }

    return programs;
  }

  /**
   * Create an iterator for a slot.
   */
  private createIterator(
    slot: SlotWithState,
    programs: ProgramWithRelationsOrm[],
  ): SlotIterator {
    const config = slot.slotConfig;
    const order = config?.order ?? 'next';
    const state = slot.state;

    // Initialize RNG
    const seed = state?.rngSeed ?? createEntropy();
    const useCount = state?.rngUseCount ?? 0;
    const mt = MersenneTwister19937.seedWithArray(seed).discard(useCount);
    const random = new Random(mt);

    // Sort programs based on order
    let sortedPrograms = this.sortPrograms(programs, order, config?.direction);

    // Handle shuffle order from state
    let shuffleOrder: string[] | null = null;
    if (order === 'shuffle' || order === 'ordered_shuffle') {
      if (
        state?.shuffleOrder &&
        state.shuffleOrder.length === programs.length
      ) {
        // Use existing shuffle order
        shuffleOrder = state.shuffleOrder;
        sortedPrograms = this.applyShuffleOrder(sortedPrograms, shuffleOrder);
      } else {
        // Create new shuffle order
        shuffleOrder = this.createShuffleOrder(sortedPrograms, random);
        sortedPrograms = this.applyShuffleOrder(sortedPrograms, shuffleOrder);
      }
    }

    const position = state?.iteratorPosition ?? 0;

    return {
      position: position % Math.max(1, sortedPrograms.length),
      programs: sortedPrograms,
      shuffleOrder,
      random,
      useCount: mt.getUseCount(),

      current(): ProgramWithRelationsOrm | null {
        if (this.programs.length === 0) return null;
        return this.programs[this.position] ?? null;
      },

      next(): void {
        if (this.programs.length === 0) return;
        this.position = (this.position + 1) % this.programs.length;
        // When we wrap around, we might want to reshuffle for shuffle modes
        // This is handled in the loop detection during generation
      },

      getState(): SlotStateUpdate {
        return {
          iteratorPosition: this.position,
          rngUseCount: this.useCount,
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
        // Default ordering (by index or as provided)
        return programs;

      case 'alphanumeric':
        return sortBy(programs, (p) => (dir === 1 ? p.title : -p.title.length));

      case 'chronological':
        return sortBy(programs, (p) => {
          // Use original air date or season/episode
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

  /**
   * Create a shuffle order for programs.
   */
  private createShuffleOrder(
    programs: ProgramWithRelationsOrm[],
    random: Random,
  ): string[] {
    const indices = programs.map((_, i) => i);
    // Fisher-Yates shuffle
    for (let i = indices.length - 1; i > 0; i--) {
      const j = random.integer(0, i);
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    return indices.map((i) => programs[i]!.uuid);
  }

  /**
   * Apply a shuffle order to programs.
   */
  private applyShuffleOrder(
    programs: ProgramWithRelationsOrm[],
    shuffleOrder: string[],
  ): ProgramWithRelationsOrm[] {
    const programMap = new Map(programs.map((p) => [p.uuid, p]));
    return shuffleOrder
      .map((uuid) => programMap.get(uuid))
      .filter((p): p is ProgramWithRelationsOrm => p !== undefined);
  }

  /**
   * Main schedule generation algorithm.
   */
  private generateScheduleItems(
    schedule: InfiniteScheduleWithSlotsAndState,
    slotPrograms: SlotPrograms[],
    fromTimeMs: number,
    toTimeMs: number,
  ): GenerationResult {
    const items: NewGeneratedScheduleItem[] = [];
    const slotStates = new Map<string, SlotStateUpdate>();

    // Filter to only floating slots (non-anchored) for Phase 1
    const floatingSlots = slotPrograms.filter((sp) =>
      isNil(sp.slot.anchorTime),
    );

    if (floatingSlots.length === 0) {
      this.logger.warn('No floating slots found in schedule');
      return { items, fromTimeMs, toTimeMs, slotStates };
    }

    let currentTimeMs = fromTimeMs;
    let sequenceIndex = 0;

    // Calculate total weight for weighted random selection
    const totalWeight = sumBy(floatingSlots, (sp) => sp.slot.weight);

    while (currentTimeMs < toTimeMs) {
      // Select a slot using weighted random selection
      const selectedSlotPrograms = this.selectSlotWeighted(
        floatingSlots,
        totalWeight,
      );

      if (!selectedSlotPrograms) {
        // No slots available, add flex
        const flexDuration = Math.min(schedule.padMs, toTimeMs - currentTimeMs);
        items.push(
          this.createFlexItem(
            schedule.uuid,
            currentTimeMs,
            flexDuration,
            sequenceIndex++,
          ),
        );
        currentTimeMs += flexDuration;
        continue;
      }

      const { slot, iterator } = selectedSlotPrograms;

      // Handle special slot types
      if (slot.slotType === 'redirect') {
        const redirectDuration = schedule.padMs;
        items.push(
          this.createRedirectItem(
            schedule.uuid,
            slot,
            currentTimeMs,
            redirectDuration,
            sequenceIndex++,
          ),
        );
        currentTimeMs += redirectDuration;
        continue;
      }

      if (slot.slotType === 'flex') {
        const flexDuration = schedule.padMs;
        items.push(
          this.createFlexItem(
            schedule.uuid,
            currentTimeMs,
            flexDuration,
            sequenceIndex++,
          ),
        );
        currentTimeMs += flexDuration;
        continue;
      }

      // Get next program from iterator
      const program = iterator.current();
      if (!program) {
        // No programs in slot, add flex
        const flexDuration = schedule.padMs;
        items.push(
          this.createFlexItem(
            schedule.uuid,
            currentTimeMs,
            flexDuration,
            sequenceIndex++,
          ),
        );
        currentTimeMs += flexDuration;
        continue;
      }

      // Add padding if configured
      const padMs = slot.padMs ?? schedule.padMs;
      let programDuration = program.duration;

      // Pad to multiple if configured
      if (slot.padToMultiple && slot.padToMultiple > 0) {
        const remainder = programDuration % slot.padToMultiple;
        if (remainder > 0) {
          programDuration += slot.padToMultiple - remainder;
        }
      }

      // Create the content item
      items.push(
        this.createContentItem(
          schedule.uuid,
          slot,
          program,
          currentTimeMs,
          programDuration,
          sequenceIndex++,
        ),
      );

      currentTimeMs += programDuration;

      // Add padding flex if needed
      if (padMs > 0 && schedule.flexPreference === 'end') {
        // Don't add padding after every item, it's handled by duration padding
      }

      // Advance iterator
      iterator.next();

      // Update slot state
      slotStates.set(slot.uuid, iterator.getState());
    }

    return { items, fromTimeMs, toTimeMs, slotStates };
  }

  /**
   * Select a slot using weighted random selection.
   */
  private selectSlotWeighted(
    slots: SlotPrograms[],
    _totalWeight: number, // Will be used for weighted random in Phase 2
  ): SlotPrograms | null {
    if (slots.length === 0) return null;
    if (slots.length === 1) return slots[0]!;

    // Simple round-robin for now (weighted random in Phase 2)
    // This ensures deterministic behavior for Phase 1
    const index = Date.now() % slots.length;
    return slots[index]!;
  }

  /**
   * Create a content item.
   */
  private createContentItem(
    scheduleUuid: string,
    slot: InfiniteScheduleSlot,
    program: ProgramWithRelationsOrm,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
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
   * Create a flex item.
   */
  private createFlexItem(
    scheduleUuid: string,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
      scheduleUuid,
      programUuid: null,
      slotUuid: null,
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

  /**
   * Create a redirect item.
   */
  private createRedirectItem(
    scheduleUuid: string,
    slot: InfiniteScheduleSlot,
    startTimeMs: number,
    durationMs: number,
    sequenceIndex: number,
  ): NewGeneratedScheduleItem {
    return {
      uuid: v4(),
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
