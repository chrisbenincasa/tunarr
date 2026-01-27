import type { ProgramWithRelationsOrm } from '@/db/schema/derivedTypes.js';
import type {
  GeneratedItemType,
  NewGeneratedScheduleItem,
} from '@/db/schema/GeneratedScheduleItem.js';
import type {
  FillerListState,
  SlotFillerPersistenceState,
} from '@/db/schema/InfiniteScheduleSlotState.js';
import dayjs from '@/util/dayjs.js';
import { isNonEmptyArray } from '@/util/index.js';
import type { FillerProgram } from '@tunarr/types';
import type {
  FillerPlaybackMode,
  FillerProgrammingSlot,
  SlotFiller,
  SlotFillerTypes,
} from '@tunarr/types/api';
import type { MersenneTwister19937, Random } from 'random-js';
import { v4 } from 'uuid';
import { ProgramShuffleIteratorImpl } from './ShuffleProgramIterator.ts';
import type { SlotSchedulerProgram } from './slotSchedulerUtil.ts';
import { WeightedFillerProgramIterator } from './WeightedFillerProgramIterator.ts';

export type FillerSelection = {
  program: ProgramWithRelationsOrm;
  fillerListId: string;
  fillerType: SlotFillerTypes;
};

type ListEntry = {
  fillerListId: string;
  programs: ProgramWithRelationsOrm[];
  programByUuid: Map<string, ProgramWithRelationsOrm>;
  /** Max duration of any program in this list — used for strict-mode selection */
  maxDuration: number;
  iteratorType: 'weighted' | 'uniform';
  iterator:
    | WeightedFillerProgramIterator
    | ProgramShuffleIteratorImpl<FillerProgram>;
};

type TypeEntry = {
  listId: string;
  playbackMode: FillerPlaybackMode;
};

/**
 * Per-slot helper that owns all filler selection logic and state for one
 * generation run.  Constructed once per slot in `collectSlotPrograms` and
 * used during ordered/shuffle mode to inject filler items.
 */
export class InfiniteSlotFillerHelper {
  private listEntries = new Map<string, ListEntry>();
  private fillerByType = new Map<SlotFillerTypes, TypeEntry[]>();
  private fillerSeed: number[];
  private fillerMt: MersenneTwister19937;

  constructor(
    fillerDefs: SlotFiller[],
    programsByListId: Record<string, ProgramWithRelationsOrm[]>,
    private random: Random,
    mt: MersenneTwister19937,
    seed: number[],
    persistedState: SlotFillerPersistenceState | null,
  ) {
    this.fillerSeed = seed;
    this.fillerMt = mt;

    // Build one list entry per unique fillerListId
    for (const def of fillerDefs) {
      const fillerListId = def.fillerListId;
      const fillerOrder = def.fillerOrder ?? 'shuffle_prefer_short';
      const playbackMode: FillerPlaybackMode =
        def.playbackMode ?? { type: 'relaxed' };

      if (!this.listEntries.has(fillerListId)) {
        const programs = programsByListId[fillerListId] ?? [];
        const programByUuid = new Map(programs.map((p) => [p.uuid, p]));
        const maxDuration = programs.reduce(
          (max, p) => Math.max(max, p.duration),
          0,
        );

        let iterator:
          | WeightedFillerProgramIterator
          | ProgramShuffleIteratorImpl<FillerProgram>;
        let iteratorType: 'weighted' | 'uniform';

        const asSlotSchedulerPrograms: SlotSchedulerProgram[] = programs.map(
          (p) => ({
            ...p,
            parentFillerLists: [fillerListId],
            parentCustomShows: [],
            parentSmartCollections: [],
          }),
        );

        if (
          fillerOrder === 'shuffle_prefer_short' ||
          fillerOrder === 'shuffle_prefer_long'
        ) {
          iteratorType = 'weighted';
          if (isNonEmptyArray(asSlotSchedulerPrograms)) {
            const fakeSlot: FillerProgrammingSlot = {
              type: 'filler',
              fillerListId,
              order: fillerOrder,
              decayFactor: 0.5,
              recoveryFactor: 0.05,
              durationWeighting: 'linear',
            };
            const weighted = new WeightedFillerProgramIterator(
              asSlotSchedulerPrograms,
              fakeSlot,
              this.random,
            );
            // Restore persisted weights if available
            const persistedListState =
              persistedState?.byListId[fillerListId] ?? null;
            if (persistedListState) {
              weighted.restoreState(persistedListState);
            }
            iterator = weighted;
          } else {
            // Fall back to uniform when list is empty
            iteratorType = 'uniform';
            iterator = new ProgramShuffleIteratorImpl([], this.random, (p) => ({
              type: 'filler',
              duration: p.duration,
              fillerListId,
              id: p.uuid,
              persisted: true,
            }));
          }
        } else {
          // uniform
          iteratorType = 'uniform';
          iterator = new ProgramShuffleIteratorImpl(
            asSlotSchedulerPrograms,
            this.random,
            (p) => ({
              type: 'filler',
              duration: p.duration,
              fillerListId,
              id: p.uuid,
              persisted: true,
            }),
          );
        }

        this.listEntries.set(fillerListId, {
          fillerListId,
          programs,
          programByUuid,
          maxDuration,
          iteratorType,
          iterator,
        });
      }

      // Map the singular type to this list entry
      const type = def.type;
      const existing = this.fillerByType.get(type) ?? [];
      // Avoid duplicate entries for the same (fillerListId, type) pair
      if (!existing.some((e) => e.listId === fillerListId)) {
        existing.push({ listId: fillerListId, playbackMode });
        this.fillerByType.set(type, existing);
      }
    }
  }

  hasType(type: SlotFillerTypes): boolean {
    const entries = this.fillerByType.get(type);
    return !!entries && entries.length > 0;
  }

  /**
   * Returns the playback mode for the first config entry matching this type.
   * Returns null if no entry exists for this type.
   */
  getPlaybackMode(type: SlotFillerTypes): FillerPlaybackMode | null {
    const entries = this.fillerByType.get(type);
    if (!entries || entries.length === 0) return null;
    return entries[0]!.playbackMode;
  }

  /**
   * Select one filler program of the given type.
   *
   * For strict mode callers pass a large max (e.g. their list's maxDuration) —
   * all programs qualify.  For relaxed callers pass the remaining flex budget.
   *
   * Returns null if no program fits after up to 3 attempts per list.
   */
  select(
    type: SlotFillerTypes,
    maxDurationMs: number,
    currentTimeMs: number,
  ): FillerSelection | null {
    const typeEntries = this.fillerByType.get(type);
    if (!typeEntries || typeEntries.length === 0) return null;

    for (const { listId } of typeEntries) {
      const entry = this.listEntries.get(listId);
      if (!entry || entry.programs.length === 0) continue;

      const selected = this.selectFromEntry(
        entry,
        maxDurationMs,
        currentTimeMs,
      );
      if (selected) {
        return { program: selected, fillerListId: listId, fillerType: type };
      }
    }

    return null;
  }

  private selectFromEntry(
    entry: ListEntry,
    maxDurationMs: number,
    currentTimeMs: number,
  ): ProgramWithRelationsOrm | null {
    const MAX_RETRIES = 3;

    if (entry.iteratorType === 'weighted') {
      const weighted = entry.iterator as WeightedFillerProgramIterator;
      // For strict (maxDurationMs is very large), pass the actual max program
      // duration so the weighted iterator considers ALL programs.
      const slotDuration = Math.min(maxDurationMs, entry.maxDuration);
      const result = weighted.current({
        slotDuration,
        timeCursor: currentTimeMs,
      });
      if (result?.id) {
        const program = entry.programByUuid.get(result.id);
        if (program) {
          weighted.next();
          return program;
        }
      }
      return null;
    }

    // Uniform shuffle: iterate up to MAX_RETRIES positions looking for a fit
    const shuffle = entry.iterator as ProgramShuffleIteratorImpl<FillerProgram>;
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const result = shuffle.current();
      if (!result) break;
      const program = result.id ? entry.programByUuid.get(result.id) : null;
      if (program && program.duration <= maxDurationMs) {
        shuffle.next();
        return program;
      }
      // This program doesn't fit — advance and try the next
      shuffle.next();
    }
    return null;
  }

  /**
   * Emit filler items of the given type and return them along with total time consumed.
   *
   * Modes:
   * - `relaxed`: emit at most 1 item within `flexBudgetMs`
   * - `count`: emit exactly N items unconditionally
   * - `duration`: emit items until `durationMs` time target is met
   * - `random_count`: emit a random number of items between min and available count
   */
  emitFillerItems(
    type: SlotFillerTypes,
    channelUuid: string,
    scheduleUuid: string,
    slotUuid: string,
    startTimeMs: number,
    playbackMode: FillerPlaybackMode,
    flexBudgetMs: number,
    startSeqIndex: number,
  ): {
    items: NewGeneratedScheduleItem[];
    timeConsumedMs: number;
    nextSeqIndex: number;
  } {
    const items: NewGeneratedScheduleItem[] = [];
    let timeConsumed = 0;
    let seqIndex = startSeqIndex;

    switch (playbackMode.type) {
      case 'relaxed': {
        // At most 1 item within the flex budget
        if (flexBudgetMs > 0) {
          const sel = this.select(type, flexBudgetMs, startTimeMs);
          if (sel) {
            items.push(
              this.createFillerItem(
                channelUuid,
                scheduleUuid,
                slotUuid,
                sel.program,
                type,
                sel.fillerListId,
                startTimeMs,
                sel.program.duration,
                seqIndex++,
              ),
            );
            timeConsumed += sel.program.duration;
          }
        }
        break;
      }
      case 'count': {
        for (let i = 0; i < playbackMode.count; i++) {
          const sel = this.select(
            type,
            Number.MAX_SAFE_INTEGER,
            startTimeMs + timeConsumed,
          );
          if (!sel) break;
          items.push(
            this.createFillerItem(
              channelUuid,
              scheduleUuid,
              slotUuid,
              sel.program,
              type,
              sel.fillerListId,
              startTimeMs + timeConsumed,
              sel.program.duration,
              seqIndex++,
            ),
          );
          timeConsumed += sel.program.duration;
        }
        break;
      }
      case 'duration': {
        const targetMs = playbackMode.durationMs;
        while (timeConsumed < targetMs) {
          const remaining = targetMs - timeConsumed;
          const sel = this.select(type, remaining, startTimeMs + timeConsumed);
          if (!sel) break;
          items.push(
            this.createFillerItem(
              channelUuid,
              scheduleUuid,
              slotUuid,
              sel.program,
              type,
              sel.fillerListId,
              startTimeMs + timeConsumed,
              sel.program.duration,
              seqIndex++,
            ),
          );
          timeConsumed += sel.program.duration;
        }
        break;
      }
      case 'random_count': {
        const typeEntries = this.fillerByType.get(type) ?? [];
        const totalSize = typeEntries.reduce((sum, { listId }) => {
          const entry = this.listEntries.get(listId);
          return sum + (entry?.programs.length ?? 0);
        }, 0);
        if (totalSize === 0) break;
        const min = playbackMode.min ?? 1;
        const max = Math.min(playbackMode.max ?? totalSize, totalSize);
        const n = this.random.integer(min, Math.max(min, max));
        for (let i = 0; i < n; i++) {
          const sel = this.select(
            type,
            Number.MAX_SAFE_INTEGER,
            startTimeMs + timeConsumed,
          );
          if (!sel) break;
          items.push(
            this.createFillerItem(
              channelUuid,
              scheduleUuid,
              slotUuid,
              sel.program,
              type,
              sel.fillerListId,
              startTimeMs + timeConsumed,
              sel.program.duration,
              seqIndex++,
            ),
          );
          timeConsumed += sel.program.duration;
        }
        break;
      }
    }

    return { items, timeConsumedMs: timeConsumed, nextSeqIndex: seqIndex };
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

  getState(): SlotFillerPersistenceState {
    const byListId: Record<string, FillerListState> = {};

    for (const [listId, entry] of this.listEntries) {
      if (entry.iteratorType === 'weighted') {
        const weighted = entry.iterator as WeightedFillerProgramIterator;
        byListId[listId] = weighted.serializeState();
      }
      // Uniform iterators don't have per-list state beyond the shared RNG
    }

    return {
      rngSeed: this.fillerSeed,
      rngUseCount: this.fillerMt.getUseCount(),
      byListId,
    };
  }
}
