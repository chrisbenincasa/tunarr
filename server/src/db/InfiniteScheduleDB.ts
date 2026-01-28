import { KEYS } from '@/types/inject.js';
import dayjs from '@/util/dayjs.js';
import type {
  CreateInfiniteScheduleRequest,
  ScheduleSlot as InfiniteScheduleSlotApi,
  UpdateInfiniteScheduleRequest,
} from '@tunarr/types/api';
import { and, asc, eq, gte, lt, lte, sql } from 'drizzle-orm';
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
} from './schema/InfiniteScheduleSlotState.ts';
import { DrizzleDBAccess } from './schema/index.ts';

export type InfiniteScheduleWithSlots = InfiniteSchedule & {
  slots: InfiniteScheduleSlot[];
};

export type InfiniteScheduleSlotWithState = InfiniteScheduleSlot & {
  state: InfiniteScheduleSlotState | null;
};

export type InfiniteScheduleWithSlotsAndState = InfiniteSchedule & {
  slots: InfiniteScheduleSlotWithState[];
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
   * Get a schedule with slot states
   */
  async getScheduleWithState(
    uuid: string,
  ): Promise<InfiniteScheduleWithSlotsAndState | null> {
    const result = await this.drizzle.query.infiniteSchedule.findFirst({
      where: eq(InfiniteSchedule.uuid, uuid),
      with: {
        slots: {
          orderBy: asc(InfiniteScheduleSlot.slotIndex),
          with: {
            state: true,
          },
        },
      },
    });
    return result ?? null;
  }

  /**
   * Get schedule by channel UUID with states
   */
  async getScheduleByChannelWithState(
    channelUuid: string,
  ): Promise<InfiniteScheduleWithSlotsAndState | null> {
    const result = await this.drizzle.query.channelSchedule.findFirst({
      where: (fields, { eq }) => eq(fields.channelId, channelUuid),
      with: {
        infiniteSchedule: {
          with: {
            slots: {
              orderBy: (fields, { asc }) => asc(fields.slotIndex),
              with: {
                state: true,
              },
            },
          },
        },
      },
    });
    return result?.infiniteSchedule ?? null;
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
      padMs: Math.max(request.padMs, 1),
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

    // Link the channel to this schedule
    // await this.drizzle
    //   .update(Channel)
    //   .set({ infiniteScheduleUuid: scheduleUuid })
    //   .where(eq(Channel.uuid, request.channelUuid));

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

    const now = +dayjs();
    const updateData = omitBy(
      {
        padMs: request.padMs,
        flexPreference: request.flexPreference,
        timeZoneOffset: request.timeZoneOffset,
        bufferDays: request.bufferDays,
        bufferThresholdDays: request.bufferThresholdDays,
        enabled: request.enabled,
        updatedAt: now,
      },
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
   * Create slots for a schedule
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

    // Create initial state for each slot
    const stateRecords: NewInfiniteScheduleSlotState[] = slotRecords.map(
      (slot) => ({
        uuid: v4(),
        slotUuid: slot.uuid,
        rngSeed: null,
        rngUseCount: 0,
        iteratorPosition: 0,
        shuffleOrder: null,
        lastScheduledAt: null,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      }),
    );

    for (const batch of chunk(stateRecords, 100)) {
      await this.drizzle.insert(InfiniteScheduleSlotState).values(batch);
    }

    return insertedSlots;
  }

  async addSlot(scheduleUuid: string, slot: InfiniteScheduleSlotApi) {
    return await this.drizzle.transaction(async (tx) => {
      const now = dayjs();

      const slotRecord = {
        uuid: slot.uuid ?? v4(),
        scheduleUuid,
        slotIndex: slot.slotIndex, // ?? index,
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
        padMs: slot.padMs ?? null,
        padToMultiple: slot.padToMultiple ?? null,
        fillerConfig: slot.fillerConfig ?? null,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      } satisfies NewInfiniteScheduleSlot;

      const newSlot = head(
        await tx.insert(InfiniteScheduleSlot).values(slotRecord).returning(),
      )!;

      // Create initial state for each slot
      const stateRecord = {
        uuid: v4(),
        slotUuid: slotRecord.uuid,
        rngSeed: null,
        rngUseCount: 0,
        iteratorPosition: 0,
        shuffleOrder: null,
        lastScheduledAt: null,
        createdAt: now.toDate(),
        updatedAt: now.toDate(),
      } satisfies NewInfiniteScheduleSlotState;

      await tx.insert(InfiniteScheduleSlotState).values(stateRecord);

      return newSlot;
    });
  }

  async getSlot(slotId: string): Promise<Maybe<InfiniteScheduleSlot>> {
    return await this.drizzle.query.infiniteScheduleSlot.findFirst({
      where: (fields, { eq }) => eq(field.uuid, slotId),
    });
  }

  /**
   * Replace all slots in a schedule
   */
  async replaceSlots(
    scheduleUuid: string,
    slots: InfiniteScheduleSlotApi[],
  ): Promise<InfiniteScheduleSlot[]> {
    // Delete existing slots (cascades to states)
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
   * Get slot state
   */
  async getSlotState(
    slotUuid: string,
  ): Promise<InfiniteScheduleSlotState | null> {
    const result = await this.drizzle.query.infiniteScheduleSlotState.findFirst(
      {
        where: eq(InfiniteScheduleSlotState.slotUuid, slotUuid),
      },
    );
    return result ?? null;
  }

  /**
   * Update slot state
   */
  async updateSlotState(
    slotUuid: string,
    update: Partial<
      Pick<
        InfiniteScheduleSlotState,
        | 'rngSeed'
        | 'rngUseCount'
        | 'iteratorPosition'
        | 'shuffleOrder'
        | 'lastScheduledAt'
      >
    >,
  ): Promise<void> {
    const now = dayjs();
    await this.drizzle
      .update(InfiniteScheduleSlotState)
      .set({
        ...update,
        updatedAt: now.toDate(),
      })
      .where(eq(InfiniteScheduleSlotState.slotUuid, slotUuid));
  }

  /**
   * Reset all slot seeds in a schedule
   */
  async resetSlotSeeds(scheduleUuid: string): Promise<number> {
    const now = dayjs();
    const result = await this.drizzle
      .update(InfiniteScheduleSlotState)
      .set({
        rngSeed: null,
        rngUseCount: 0,
        iteratorPosition: 0,
        shuffleOrder: null,
        updatedAt: now.toDate(),
      })
      .where(
        eq(
          InfiniteScheduleSlotState.slotUuid,
          this.drizzle
            .select({ uuid: InfiniteScheduleSlot.uuid })
            .from(InfiniteScheduleSlot)
            .where(eq(InfiniteScheduleSlot.scheduleUuid, scheduleUuid)),
        ),
      );

    return result.changes;
  }

  // ==================== Generated Schedule Items ====================

  /**
   * Get generated items for a schedule within a time range
   */
  async getGeneratedItems(
    scheduleUuid: string,
    fromTimeMs: number,
    toTimeMs: number,
  ): Promise<GeneratedScheduleItem[]> {
    return this.drizzle.query.generatedScheduleItem.findMany({
      where: and(
        eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid),
        gte(GeneratedScheduleItem.startTimeMs, fromTimeMs),
        lt(GeneratedScheduleItem.startTimeMs, toTimeMs),
      ),
      orderBy: asc(GeneratedScheduleItem.sequenceIndex),
    });
  }

  /**
   * Get the last generated item for a schedule
   */
  async getLastGeneratedItem(
    scheduleUuid: string,
  ): Promise<GeneratedScheduleItem | null> {
    const result = await this.drizzle.query.generatedScheduleItem.findFirst({
      where: eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid),
      orderBy: (fields, { desc }) => desc(fields.sequenceIndex),
    });
    return result ?? null;
  }

  /**
   * Get the item playing at a specific time
   */
  async getItemAtTime(
    scheduleUuid: string,
    timeMs: number,
  ): Promise<GeneratedScheduleItem | null> {
    // Find the item where startTimeMs <= timeMs < startTimeMs + durationMs
    const result = await this.drizzle.query.generatedScheduleItem.findFirst({
      where: and(
        eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid),
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
   * Delete generated items from a certain time onwards
   */
  async deleteGeneratedItemsFrom(
    scheduleUuid: string,
    fromTimeMs: number,
  ): Promise<number> {
    const result = await this.drizzle
      .delete(GeneratedScheduleItem)
      .where(
        and(
          eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid),
          gte(GeneratedScheduleItem.startTimeMs, fromTimeMs),
        ),
      );
    return result.changes;
  }

  /**
   * Delete generated items older than a certain time
   */
  async deleteGeneratedItemsBefore(
    scheduleUuid: string,
    beforeTimeMs: number,
  ): Promise<number> {
    const result = await this.drizzle
      .delete(GeneratedScheduleItem)
      .where(
        and(
          eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid),
          lt(
            sql`${GeneratedScheduleItem.startTimeMs} + ${GeneratedScheduleItem.durationMs}`,
            beforeTimeMs,
          ),
        ),
      );
    return result.changes;
  }

  /**
   * Clear all generated items for a schedule
   */
  async clearGeneratedItems(scheduleUuid: string): Promise<number> {
    const result = await this.drizzle
      .delete(GeneratedScheduleItem)
      .where(eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid));
    return result.changes;
  }

  /**
   * Get the buffer end time (latest end time of generated items)
   */
  async getBufferEndTime(scheduleUuid: string): Promise<number | null> {
    const lastItem = await this.getLastGeneratedItem(scheduleUuid);
    if (!lastItem) return null;
    return lastItem.startTimeMs + lastItem.durationMs;
  }

  /**
   * Count generated items for a schedule
   */
  async countGeneratedItems(scheduleUuid: string): Promise<number> {
    const result = await this.drizzle
      .select({ count: sql<number>`count(*)` })
      .from(GeneratedScheduleItem)
      .where(eq(GeneratedScheduleItem.scheduleUuid, scheduleUuid));
    return result[0]?.count ?? 0;
  }

  /**
   * Get all enabled schedules that need buffer maintenance
   */
  async getSchedulesNeedingBufferMaintenance(): Promise<InfiniteSchedule[]> {
    const now = +dayjs();

    // Get schedules where the buffer end time is less than (now + bufferThresholdDays)
    // or where there are no generated items at all
    const schedules = await this.drizzle.query.infiniteSchedule.findMany({
      where: eq(InfiniteSchedule.enabled, true),
    });

    const schedulesNeedingMaintenance: InfiniteSchedule[] = [];

    for (const schedule of schedules) {
      const bufferEnd = await this.getBufferEndTime(schedule.uuid);
      const thresholdTime =
        now + schedule.bufferThresholdDays * 24 * 60 * 60 * 1000;

      if (bufferEnd === null || bufferEnd < thresholdTime) {
        schedulesNeedingMaintenance.push(schedule);
      }
    }

    return schedulesNeedingMaintenance;
  }

  /**
   * Get the next sequence index for generated items
   */
  async getNextSequenceIndex(scheduleUuid: string): Promise<number> {
    const lastItem = await this.getLastGeneratedItem(scheduleUuid);
    return lastItem ? lastItem.sequenceIndex + 1 : 0;
  }
}
