import { KEYS } from '@/types/inject.js';
import dayjs from '@/util/dayjs.js';
import type {
  CreateInfiniteScheduleRequest,
  ScheduleSlot as InfiniteScheduleSlotApi,
  UpdateInfiniteScheduleRequest,
} from '@tunarr/types/api';
import { and, asc, eq, gte, inArray, lt, lte, sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk, head, isNil, omitBy } from 'lodash-es';
import { v4 } from 'uuid';
import { Maybe } from '../types/util.ts';
import { Channel } from './schema/Channel.ts';
import {
  GeneratedScheduleItem,
  type NewGeneratedScheduleItem,
} from './schema/GeneratedScheduleItem.ts';
import {
  InfiniteSchedule,
  type NewInfiniteSchedule,
} from './schema/InfiniteSchedule.ts';
import {
  InfiniteScheduleSlot,
  type NewInfiniteScheduleSlot,
} from './schema/InfiniteScheduleSlot.ts';
import {
  InfiniteScheduleSlotState,
  type NewInfiniteScheduleSlotState,
  type SlotFillerPersistenceState,
} from './schema/InfiniteScheduleSlotState.ts';
import {
  InfiniteScheduleState,
  type NewInfiniteScheduleState,
} from './schema/InfiniteScheduleState.ts';
import { DrizzleDBAccess } from './schema/index.ts';
import { groupByUniq } from '../util/index.ts';

export type InfiniteScheduleWithSlots = InfiniteSchedule & {
  slots: InfiniteScheduleSlot[];
};

export type InfiniteScheduleSlotWithState = InfiniteScheduleSlot & {
  state: InfiniteScheduleSlotState | null;
};

export type InfiniteScheduleWithSlotsAndState = InfiniteSchedule & {
  slots: InfiniteScheduleSlotWithState[];
  state: InfiniteScheduleState | null;
};

@injectable()
export class InfiniteScheduleDB {
  constructor(@inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess) {}

  async getSchedules(): Promise<InfiniteScheduleWithSlots[]> {
    const result = await this.drizzle.query.infiniteSchedule.findMany({
      with: {
        slots: {
          orderBy: asc(InfiniteScheduleSlot.slotIndex),
        },
      },
    });
    return result;
  }

  /**
   * Get a schedule by its UUID
   */
  async getSchedule(uuid: string): Promise<InfiniteScheduleWithSlots | null> {
    const result = await this.drizzle.query.infiniteSchedule.findFirst({
      where: eq(InfiniteSchedule.uuid, uuid),
      with: {
        slots: {
          orderBy: asc(InfiniteScheduleSlot.slotIndex),
        },
      },
    });
    return result ?? null;
  }

  /**
   * Get a schedule by channel UUID
   */
  async getScheduleByChannel(
    channelUuid: string,
  ): Promise<InfiniteScheduleWithSlots | null> {
    const result = await this.drizzle.query.channelSchedule.findFirst({
      where: (fields, { eq }) => eq(fields.channelId, channelUuid),
      with: {
        infiniteSchedule: {
          with: {
            slots: {
              orderBy: (fields, { asc }) => asc(fields.slotIndex),
            },
          },
        },
      },
    });
    return result?.infiniteSchedule ?? null;
  }

  /**
   * Get schedule by channel UUID with per-channel states loaded.
   * Returns slot states scoped to this specific channel.
   */
  async getScheduleByChannelWithState(
    channelUuid: string,
  ): Promise<InfiniteScheduleWithSlotsAndState | null> {
    // 1. Load schedule + slots (no state via Drizzle relations — state is per-channel)
    const channelSched = await this.drizzle.query.channelSchedule.findFirst({
      where: (fields, { eq }) => eq(fields.channelId, channelUuid),
      with: {
        infiniteSchedule: {
          with: {
            slots: {
              orderBy: (fields, { asc }) => asc(fields.slotIndex),
            },
          },
        },
      },
    });

    if (!channelSched?.infiniteSchedule) return null;
    const schedule = channelSched.infiniteSchedule;

    // 2. Load schedule-level state for this channel
    const scheduleState =
      (await this.drizzle.query.infiniteScheduleState.findFirst({
        where: and(
          eq(InfiniteScheduleState.scheduleUuid, schedule.uuid),
          eq(InfiniteScheduleState.channelUuid, channelUuid),
        ),
      })) ?? null;

    // 3. Load slot states for this channel
    const slotUuids = schedule.slots.map((s) => s.uuid);
    const slotStates =
      slotUuids.length > 0
        ? await this.drizzle.query.infiniteScheduleSlotState.findMany({
            where: and(
              eq(InfiniteScheduleSlotState.channelUuid, channelUuid),
              inArray(InfiniteScheduleSlotState.slotUuid, slotUuids),
            ),
          })
        : [];

    const slotStateBySlotUuid = groupByUniq(slotStates, (s) => s.slotUuid);

    // 4. Merge slot states onto slots
    return {
      ...schedule,
      state: scheduleState,
      slots: schedule.slots.map((slot) => ({
        ...slot,
        state: slotStateBySlotUuid[slot.uuid] ?? null,
      })),
    };
  }

  /**
   * Ensure slot state rows exist for the given (channelUuid, slotUuid) pairs.
   * Inserts missing rows with default (zeroed) state; ignores existing rows.
   */
  async ensureChannelSlotStates(
    channelUuid: string,
    slotUuids: string[],
  ): Promise<void> {
    if (slotUuids.length === 0) return;

    const now = dayjs();
    const records: NewInfiniteScheduleSlotState[] = slotUuids.map(
      (slotUuid) => ({
        uuid: v4(),
        channelUuid,
        slotUuid,
        rngSeed: null,
        rngUseCount: 0,
        iteratorPosition: 0,
        shuffleOrder: null,
        fillModeCount: 0,
        fillModeDurationMs: 0,
        lastScheduledAt: null,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      }),
    );

    for (const batch of chunk(records, 100)) {
      await this.drizzle
        .insert(InfiniteScheduleSlotState)
        .values(batch)
        .onConflictDoNothing();
    }
  }

  /**
   * Create a new infinite schedule
   */
  async createSchedule(
    request: CreateInfiniteScheduleRequest,
  ): Promise<InfiniteScheduleWithSlots> {
    const now = dayjs();
    const scheduleUuid = v4();

    const schedule: NewInfiniteSchedule = {
      uuid: scheduleUuid,
      name: request.name,
      padToMultiple: request.padToMultiple ?? 0,
      flexPreference: request.flexPreference ?? 'end',
      timeZoneOffset: request.timeZoneOffset ?? 0,
      bufferDays: request.bufferDays ?? 7,
      bufferThresholdDays: request.bufferThresholdDays ?? 2,
      enabled: request.enabled ?? true,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    };

    const inserted = head(
      await this.drizzle.insert(InfiniteSchedule).values(schedule).returning(),
    )!;

    // Create slots if provided
    const slots: InfiniteScheduleSlot[] = [];
    if (request.slots && request.slots.length > 0) {
      slots.push(...(await this.createSlots(scheduleUuid, request.slots)));
    }

    return {
      ...inserted,
      slots,
    };
  }

  /**
   * Update an existing schedule
   */
  async updateSchedule(
    uuid: string,
    request: UpdateInfiniteScheduleRequest,
  ): Promise<Maybe<InfiniteScheduleWithSlots>> {
    const existing = await this.getSchedule(uuid);
    if (!existing) {
      return;
    }

    const updateData = omitBy(
      {
        padToMultiple: request.padToMultiple,
        flexPreference: request.flexPreference,
        timeZoneOffset: request.timeZoneOffset,
        bufferDays: request.bufferDays,
        bufferThresholdDays: request.bufferThresholdDays,
        enabled: request.enabled,
        updatedAt: dayjs().toDate(),
      } satisfies Partial<NewInfiniteSchedule>,
      isNil,
    );

    let schedule: InfiniteSchedule = existing;
    if (Object.keys(updateData).length > 1) {
      // > 1 because updatedAt is always set
      schedule = head(
        await this.drizzle
          .update(InfiniteSchedule)
          .set(updateData)
          .where(eq(InfiniteSchedule.uuid, uuid))
          .returning(),
      )!;
    }

    // Update slots if provided
    let slots = existing.slots;
    if (request.slots) {
      slots = await this.replaceSlots(uuid, request.slots);
    }

    return {
      ...schedule,
      slots,
    };
  }

  /**
   * Delete a schedule
   */
  async deleteSchedule(uuid: string): Promise<boolean> {
    const existing = await this.getSchedule(uuid);
    if (!existing) {
      return false;
    }

    // Unlink from channel first
    await this.drizzle
      .update(Channel)
      .set({ infiniteScheduleUuid: null })
      .where(eq(Channel.infiniteScheduleUuid, uuid));

    // Delete schedule (cascades to slots, states, and generated items)
    await this.drizzle
      .delete(InfiniteSchedule)
      .where(eq(InfiniteSchedule.uuid, uuid));

    return true;
  }

  /**
   * Create slots for a schedule.
   * Note: slot states are NOT created here — they are created per-channel
   * on first generation via ensureChannelSlotStates().
   */
  private async createSlots(
    scheduleUuid: string,
    slots: InfiniteScheduleSlotApi[],
  ): Promise<InfiniteScheduleSlot[]> {
    if (slots.length === 0) {
      return [];
    }

    const now = dayjs();

    const slotRecords: NewInfiniteScheduleSlot[] = slots.map((slot, index) => ({
      uuid: slot.uuid ?? v4(),
      scheduleUuid,
      slotIndex: slot.slotIndex ?? index,
      slotType: slot.type,
      showId: slot.type === 'show' ? slot.showId : null,
      customShowId: 'customShowId' in slot ? slot.customShowId : null,
      fillerListId: 'fillerListId' in slot ? slot.fillerListId : null,
      redirectChannelId:
        'redirectChannelId' in slot ? slot.redirectChannelId : null,
      smartCollectionId:
        'smartCollectionId' in slot ? slot.smartCollectionId : null,
      slotConfig: 'slotConfig' in slot ? slot.slotConfig : null,
      anchorTime: slot.anchorTime ?? null,
      anchorMode: slot.anchorMode ?? null,
      anchorDays: slot.anchorDays ?? null,
      weight: slot.weight ?? 1,
      cooldownMs: slot.cooldownMs ?? 0,
      fillMode: slot.fillMode ?? 'fill',
      fillValue: slot.fillValue ?? null,
      padMs: slot.padMs ?? null,
      padToMultiple: slot.padToMultiple ?? null,
      fillerConfig: slot.fillerConfig ?? null,
      createdAt: now.toDate(),
      updatedAt: now.toDate(),
    }));

    // Insert slots in chunks
    const insertedSlots: InfiniteScheduleSlot[] = [];
    for (const batch of chunk(slotRecords, 100)) {
      insertedSlots.push(
        ...(await this.drizzle
          .insert(InfiniteScheduleSlot)
          .values(batch)
          .returning()),
      );
    }

    return insertedSlots;
  }

  async addSlot(scheduleUuid: string, slot: InfiniteScheduleSlotApi) {
    return await this.drizzle.transaction(async (tx) => {
      const now = dayjs();

      const slotRecord = {
        uuid: slot.uuid ?? v4(),
        scheduleUuid,
        slotIndex: slot.slotIndex,
        slotType: slot.type,
        showId: slot.type === 'show' ? slot.showId : null,
        customShowId: slot.type === 'custom-show' ? slot.customShowId : null,
        fillerListId: slot.type === 'filler' ? slot.fillerListId : null,
        redirectChannelId:
          slot.type === 'redirect' ? slot.redirectChannelId : null,
        smartCollectionId:
          slot.type === 'smart-collection' ? slot.smartCollectionId : null,
        slotConfig: 'slotConfig' in slot ? slot.slotConfig : null,
        anchorTime: slot.anchorTime ?? null,
        anchorMode: slot.anchorMode ?? null,
        anchorDays: slot.anchorDays ?? null,
        weight: slot.weight ?? 1,
        cooldownMs: slot.cooldownMs ?? 0,
        fillMode: slot.fillMode ?? 'fill',
        fillValue: slot.fillValue ?? null,
        padMs: slot.padMs ?? null,
        padToMultiple: slot.padToMultiple ?? null,
        fillerConfig: slot.fillerConfig ?? null,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      } satisfies NewInfiniteScheduleSlot;

      const newSlot = head(
        await tx.insert(InfiniteScheduleSlot).values(slotRecord).returning(),
      )!;

      // Slot states are created per-channel on first generation via ensureChannelSlotStates()

      return newSlot;
    });
  }

  async updateSlot(slotId: string, slot: InfiniteScheduleSlotApi) {
    return await this.drizzle.transaction(async (tx) => {
      const now = dayjs();

      const slotRecord = {
        slotIndex: slot.slotIndex,
        slotType: slot.type,
        showId: slot.type === 'show' ? slot.showId : null,
        customShowId: slot.type === 'custom-show' ? slot.customShowId : null,
        fillerListId: slot.type === 'filler' ? slot.fillerListId : null,
        redirectChannelId:
          slot.type === 'redirect' ? slot.redirectChannelId : null,
        smartCollectionId:
          slot.type === 'smart-collection' ? slot.smartCollectionId : null,
        slotConfig: 'slotConfig' in slot ? slot.slotConfig : null,
        anchorTime: slot.anchorTime ?? null,
        anchorMode: slot.anchorMode ?? null,
        anchorDays: slot.anchorDays ?? null,
        weight: slot.weight ?? 1,
        cooldownMs: slot.cooldownMs ?? 0,
        fillMode: slot.fillMode ?? 'fill',
        fillValue: slot.fillValue ?? null,
        padMs: slot.padMs ?? null,
        padToMultiple: slot.padToMultiple ?? null,
        fillerConfig: slot.fillerConfig ?? null,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      };

      const newSlot = head(
        await tx
          .update(InfiniteScheduleSlot)
          .set(slotRecord)
          .where(eq(InfiniteScheduleSlot.uuid, slotId))
          .returning(),
      )!;

      return newSlot;
    });
  }

  async getSlot(slotId: string): Promise<Maybe<InfiniteScheduleSlot>> {
    return await this.drizzle.query.infiniteScheduleSlot.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, slotId),
    });
  }

  /**
   * Replace all slots in a schedule
   */
  async replaceSlots(
    scheduleUuid: string,
    slots: InfiniteScheduleSlotApi[],
  ): Promise<InfiniteScheduleSlot[]> {
    // Delete existing slots (cascades to slot states and generated items via slot FK)
    await this.drizzle
      .delete(InfiniteScheduleSlot)
      .where(eq(InfiniteScheduleSlot.scheduleUuid, scheduleUuid));

    // Create new slots
    if (slots.length > 0) {
      return await this.createSlots(scheduleUuid, slots);
    }

    return [];
  }

  /**
   * Get slot state for a channel+slot pair
   */
  async getSlotState(
    channelUuid: string,
    slotUuid: string,
  ): Promise<InfiniteScheduleSlotState | null> {
    const result = await this.drizzle.query.infiniteScheduleSlotState.findFirst(
      {
        where: and(
          eq(InfiniteScheduleSlotState.channelUuid, channelUuid),
          eq(InfiniteScheduleSlotState.slotUuid, slotUuid),
        ),
      },
    );
    return result ?? null;
  }

  /**
   * Update slot state for a specific channel+slot pair
   */
  async updateSlotState(
    channelUuid: string,
    slotUuid: string,
    update: Partial<
      Pick<
        InfiniteScheduleSlotState,
        | 'rngSeed'
        | 'rngUseCount'
        | 'iteratorPosition'
        | 'shuffleOrder'
        | 'lastScheduledAt'
        | 'fillModeCount'
        | 'fillModeDurationMs'
      >
    > & { fillerState?: SlotFillerPersistenceState | null },
  ): Promise<void> {
    const now = dayjs();
    await this.drizzle
      .update(InfiniteScheduleSlotState)
      .set({
        ...update,
        updatedAt: now.toDate(),
      })
      .where(
        and(
          eq(InfiniteScheduleSlotState.channelUuid, channelUuid),
          eq(InfiniteScheduleSlotState.slotUuid, slotUuid),
        ),
      );
  }

  /**
   * Upsert the schedule-level generation state for a specific channel.
   * Conflict key is channelUuid — one state row per channel.
   */
  async upsertScheduleState(
    channelUuid: string,
    scheduleUuid: string,
    update: {
      floatingSlotIndex: number;
      generationCursor: number;
      slotSelectionSeed: number[] | null;
      slotSelectionUseCount: number;
    },
  ): Promise<void> {
    const now = dayjs();
    await this.drizzle
      .insert(InfiniteScheduleState)
      .values({
        uuid: v4(),
        channelUuid,
        scheduleUuid,
        floatingSlotIndex: update.floatingSlotIndex,
        generationCursor: new Date(update.generationCursor),
        slotSelectionSeed: update.slotSelectionSeed,
        slotSelectionUseCount: update.slotSelectionUseCount,
        lastGeneratedAt: now.toDate(),
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      } satisfies NewInfiniteScheduleState)
      .onConflictDoUpdate({
        target: InfiniteScheduleState.channelUuid,
        set: {
          scheduleUuid,
          floatingSlotIndex: update.floatingSlotIndex,
          generationCursor: new Date(update.generationCursor),
          slotSelectionSeed: update.slotSelectionSeed,
          slotSelectionUseCount: update.slotSelectionUseCount,
          lastGeneratedAt: now.toDate(),
          updatedAt: now.toDate(),
        },
      });
  }

  /**
   * Reset all slot seeds for a channel (clears RNG state and iterator positions)
   */
  async resetSlotSeeds(channelUuid: string): Promise<number> {
    const now = dayjs();
    const result = await this.drizzle
      .update(InfiniteScheduleSlotState)
      .set({
        rngSeed: null,
        rngUseCount: 0,
        iteratorPosition: 0,
        shuffleOrder: null,
        fillModeCount: 0,
        fillModeDurationMs: 0,
        updatedAt: now.toDate(),
      })
      .where(eq(InfiniteScheduleSlotState.channelUuid, channelUuid));

    return result.changes;
  }

  // ==================== Generated Schedule Items ====================

  /**
   * Get generated items for a channel within a time range
   */
  async getGeneratedItems(
    channelUuid: string,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<GeneratedScheduleItem[]> {
    return this.drizzle.query.generatedScheduleItem.findMany({
      where: and(
        eq(GeneratedScheduleItem.channelUuid, channelUuid),
        gte(GeneratedScheduleItem.startTimeMs, fromTimeMs),
        lt(GeneratedScheduleItem.startTimeMs, toTimeMs),
      ),
      orderBy: asc(GeneratedScheduleItem.sequenceIndex),
    });
  }

  /**
   * Get the last generated item for a channel
   */
  async getLastGeneratedItem(
    channelUuid: string,
  ): Promise<GeneratedScheduleItem | null> {
    const result = await this.drizzle.query.generatedScheduleItem.findFirst({
      where: eq(GeneratedScheduleItem.channelUuid, channelUuid),
      orderBy: (fields, { desc }) => desc(fields.sequenceIndex),
    });
    return result ?? null;
  }

  /**
   * Get the item playing at a specific time for a channel
   */
  async getItemAtTime(
    channelUuid: string,
    timeMs: number,
  ): Promise<GeneratedScheduleItem | null> {
    const result = await this.drizzle.query.generatedScheduleItem.findFirst({
      where: and(
        eq(GeneratedScheduleItem.channelUuid, channelUuid),
        lte(GeneratedScheduleItem.startTimeMs, timeMs),
        gte(
          sql`${GeneratedScheduleItem.startTimeMs} + ${GeneratedScheduleItem.durationMs}`,
          timeMs,
        ),
      ),
    });
    return result ?? null;
  }

  /**
   * Insert generated items
   */
  async insertGeneratedItems(items: NewGeneratedScheduleItem[]): Promise<void> {
    if (items.length === 0) return;

    for (const batch of chunk(items, 100)) {
      await this.drizzle.insert(GeneratedScheduleItem).values(batch);
    }
  }

  /**
   * Delete generated items from a certain time onwards for a channel
   */
  async deleteGeneratedItemsFrom(
    channelUuid: string,
    fromTimeMs: number,
  ): Promise<number> {
    const result = await this.drizzle
      .delete(GeneratedScheduleItem)
      .where(
        and(
          eq(GeneratedScheduleItem.channelUuid, channelUuid),
          gte(GeneratedScheduleItem.startTimeMs, fromTimeMs),
        ),
      );
    return result.changes;
  }

  /**
   * Delete generated items older than a certain time for a channel
   */
  async deleteGeneratedItemsBefore(
    channelUuid: string,
    beforeTimeMs: number,
  ): Promise<number> {
    const result = await this.drizzle
      .delete(GeneratedScheduleItem)
      .where(
        and(
          eq(GeneratedScheduleItem.channelUuid, channelUuid),
          lt(
            sql`${GeneratedScheduleItem.startTimeMs} + ${GeneratedScheduleItem.durationMs}`,
            beforeTimeMs,
          ),
        ),
      );
    return result.changes;
  }

  /**
   * Clear all generated items for a channel
   */
  async clearGeneratedItems(channelUuid: string): Promise<number> {
    const result = await this.drizzle
      .delete(GeneratedScheduleItem)
      .where(eq(GeneratedScheduleItem.channelUuid, channelUuid));
    return result.changes;
  }

  /**
   * Get the buffer end time (latest end time of generated items) for a channel
   */
  async getBufferEndTime(channelUuid: string): Promise<number | null> {
    const lastItem = await this.getLastGeneratedItem(channelUuid);
    if (!lastItem) return null;
    return lastItem.startTimeMs + lastItem.durationMs;
  }

  /**
   * Count generated items for a channel
   */
  async countGeneratedItems(channelUuid: string): Promise<number> {
    const result = await this.drizzle
      .select({ count: sql<number>`count(*)` })
      .from(GeneratedScheduleItem)
      .where(eq(GeneratedScheduleItem.channelUuid, channelUuid));
    return result[0]?.count ?? 0;
  }

  /**
   * Get all enabled schedules that need buffer maintenance.
   * TODO: This should be channel-scoped once background maintenance is implemented.
   */
  async getSchedulesNeedingBufferMaintenance(): Promise<InfiniteSchedule[]> {
    const schedules = await this.drizzle.query.infiniteSchedule.findMany({
      where: eq(InfiniteSchedule.enabled, true),
    });

    const schedulesNeedingMaintenance: InfiniteSchedule[] = [];

    for (const schedule of schedules) {
      // TODO: query per channel-schedule binding once buffer maintenance is channel-scoped
      schedulesNeedingMaintenance.push(schedule);
    }

    return schedulesNeedingMaintenance;
  }

  /**
   * Get the next sequence index for generated items for a channel
   */
  async getNextSequenceIndex(channelUuid: string): Promise<number> {
    const lastItem = await this.getLastGeneratedItem(channelUuid);
    return lastItem ? lastItem.sequenceIndex + 1 : 0;
  }
}
