import type {
  InfiniteScheduleDB,
  InfiniteScheduleWithSlotsAndState,
} from '@/db/InfiniteScheduleDB.js';
import type {
  GeneratedScheduleItem,
  NewGeneratedScheduleItem,
} from '@/db/schema/GeneratedScheduleItem.js';
import { KEYS } from '@/types/inject.js';
import type { RouterPluginAsyncCallback } from '@/types/serverType.js';
import { LoggerFactory } from '@/util/logging/LoggerFactory.js';
import {
  BasicIdParamSchema,
  CreateInfiniteScheduleRequestSchema,
  GeneratedScheduleItemSchema,
  InfiniteSchedulePreviewRequestSchema,
  MaterializedScheduleSchema,
  ScheduleSchema,
  ScheduleSlotSchema,
  UpdateInfiniteScheduleRequestSchema,
} from '@tunarr/types/api';
import { SlotStateSchema } from '@tunarr/types/schemas';
import { isNil } from 'lodash-es';
import { v4 } from 'uuid';
import { z } from 'zod/v4';
import { MaterializeScheduleCommand } from '../commands/MaterializeScheduleCommand.ts';
import { container } from '../container.ts';
import { InfiniteScheduleGenerator } from '../services/scheduling/InfiniteScheduleGenerator.ts';
import {
  scheduleDaoToDto,
  slotDaoToDto,
} from './converters/scheduleConverters.ts';

const ChannelIdParamSchema = z.object({
  id: z.string(),
});

const SlotIdParamSchema = z.object({
  id: z.string(),
  slotId: z.string(),
});

// Helper function to convert generated item to API format
function generatedItemToApi(
  item: GeneratedScheduleItem | NewGeneratedScheduleItem,
) {
  return {
    uuid: item.uuid,
    scheduleUuid: item.scheduleUuid,
    programUuid: item.programUuid ?? null,
    slotUuid: item.slotUuid ?? null,
    itemType: item.itemType,
    startTimeMs: item.startTimeMs,
    durationMs: item.durationMs,
    redirectChannelUuid: item.redirectChannelUuid ?? null,
    fillerListId: item.fillerListId ?? null,
    fillerType: item.fillerType ?? null,
    sequenceIndex: item.sequenceIndex,
    createdAt: item.createdAt ?? null,
  };
}

export const infiniteScheduleApi: RouterPluginAsyncCallback = async (
  fastify,
  // eslint-disable-next-line @typescript-eslint/require-await
) => {
  const logger = LoggerFactory.child({
    caller: import.meta,
    className: 'InfiniteScheduleApi',
  });

  fastify.addHook('onError', (req, _, error, done) => {
    logger.error({
      error,
      method: req.routeOptions.method,
      url: req.routeOptions.url,
    });
    done();
  });

  const getInfiniteScheduleDB = () =>
    container.get<InfiniteScheduleDB>(KEYS.InfiniteScheduleDB);

  const getGenerator = () =>
    container.get<InfiniteScheduleGenerator>(InfiniteScheduleGenerator);

  fastify.get(
    '/schedules',
    {
      schema: {
        operationId: 'getSchedules',
        tags: ['Schedules'],
        response: {
          200: ScheduleSchema.array(),
        },
      },
    },
    async (req, res) => {
      const schedules = await req.serverCtx.infiniteScheduleDB.getSchedules();
      return res.send(schedules.map(scheduleDaoToDto));
    },
  );

  fastify.get(
    '/schedules/:id',
    {
      schema: {
        operationId: 'getScheduleById',
        tags: ['Schedules'],
        params: BasicIdParamSchema,
        response: {
          200: MaterializedScheduleSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const schedule = await container
        .get<MaterializeScheduleCommand>(MaterializeScheduleCommand)
        .execute({ scheduleId: req.params.id });
      if (!schedule) {
        return res.status(404).send();
      }
      return res.send(schedule);
    },
  );

  fastify.post(
    '/schedules',
    {
      schema: {
        body: CreateInfiniteScheduleRequestSchema,
        response: {
          201: ScheduleSchema,
        },
      },
    },
    async (req, res) => {
      const result = await req.serverCtx.infiniteScheduleDB.createSchedule(
        req.body,
      );
      return res.status(201).send(scheduleDaoToDto(result));
    },
  );

  fastify.put(
    '/schedules/:id',
    {
      schema: {
        operationId: 'updateScheduleById',
        tags: ['Schedules'],
        params: BasicIdParamSchema,
        body: UpdateInfiniteScheduleRequestSchema,
        response: {
          200: ScheduleSchema,
          404: z.void(),
        },
      },
    },
    async (req, res) => {
      const result = await req.serverCtx.infiniteScheduleDB.updateSchedule(
        req.params.id,
        req.body,
      );
      if (!result) {
        return res.status(404).send();
      }
      return res.status(200).send(scheduleDaoToDto(result));
    },
  );

  fastify.post(
    '/schedules/:id/slots',
    {
      schema: {
        operationId: 'addSlotToSchedule',
        tags: ['Scnedules'],
        params: BasicIdParamSchema,
        body: ScheduleSlotSchema,
        response: {
          201: ScheduleSlotSchema,
        },
      },
    },
    async (req, res) => {
      const slot = await req.serverCtx.infiniteScheduleDB.addSlot(
        req.params.id,
        req.body,
      );
      return res.status(201).send(slotDaoToDto(slot));
    },
  );

  /**
   * Get infinite schedule for a channel
   */
  fastify.get(
    '/channels/:id/infinite-schedule',
    {
      schema: {
        operationId: 'getChannelSchedule',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        response: {
          200: ScheduleSchema,
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      // Convert slots to API format
      const response = {
        ...schedule,
        slots: schedule.slots.map(slotDaoToDto),
      };

      return res.send(response);
    },
  );

  /**
   * Create infinite schedule for a channel
   */
  fastify.post(
    '/channels/:id/schedule',
    {
      schema: {
        operationId: 'createScheduleForChannel',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        body: CreateInfiniteScheduleRequestSchema,
        response: {
          201: z.object({ uuid: z.string() }),
          400: z.object({ error: z.string() }),
          404: z.object({ error: z.string() }),
          409: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();

      // Check if schedule already exists
      const existingSchedule = await db.getScheduleByChannel(channel.uuid);
      if (existingSchedule) {
        return res
          .status(409)
          .send({ error: 'Infinite schedule already exists for this channel' });
      }

      const uuid = await db.createSchedule({
        ...req.body,
        channelUuid: channel.uuid,
      });

      return res.status(201).send({ uuid });
    },
  );

  /**
   * Update infinite schedule for a channel
   */
  fastify.put(
    '/channels/:id/infinite-schedule',
    {
      schema: {
        operationId: 'updateInfiniteSchedule',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        body: UpdateInfiniteScheduleRequestSchema,
        response: {
          200: z.object({ success: z.boolean() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      const success = await db.updateSchedule(schedule.uuid, req.body);
      return res.send({ success });
    },
  );

  /**
   * Delete infinite schedule for a channel
   */
  fastify.delete(
    '/channels/:id/infinite-schedule',
    {
      schema: {
        operationId: 'deleteInfiniteSchedule',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        response: {
          200: z.object({ success: z.boolean() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      const success = await db.deleteSchedule(schedule.uuid);
      return res.send({ success });
    },
  );

  /**
   * Preview schedule generation without persisting
   */
  fastify.post(
    '/channels/:id/infinite-schedule/preview',
    {
      schema: {
        operationId: 'previewInfiniteSchedule',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        body: InfiniteSchedulePreviewRequestSchema,
        response: {
          200: z.object({
            items: z.array(GeneratedScheduleItemSchema),
            fromTimeMs: z.number(),
            toTimeMs: z.number(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const generator = getGenerator();

      // Create a temporary schedule structure for preview
      const scheduleForPreview = {
        uuid: v4(),
        padMs: req.body.padMs ?? 300000,
        flexPreference: req.body.flexPreference ?? ('end' as const),
        timeZoneOffset: req.body.timeZoneOffset ?? 0,
        bufferDays: 7,
        bufferThresholdDays: 2,
        enabled: true,
        createdAt: new Date(),
        updatedAt: new Date(),
        slots: (req.body.slots ?? []).map((slot, index) => ({
          uuid: slot.uuid ?? `preview-slot-${index}`,
          scheduleUuid: 'preview',
          slotIndex: slot.slotIndex ?? index,
          slotType: slot.type,
          showId: 'showId' in slot ? slot.showId : null,
          customShowId: 'customShowId' in slot ? slot.customShowId : null,
          fillerListId: 'fillerListId' in slot ? slot.fillerListId : null,
          redirectChannelId:
            'redirectChannelId' in slot ? slot.redirectChannelId : null,
          smartCollectionId:
            'smartCollectionId' in slot ? slot.smartCollectionId : null,
          slotConfig:
            'slotConfig' in slot && slot.slotConfig !== undefined
              ? slot.slotConfig
              : null,
          anchorTime: slot.anchorTime ?? null,
          anchorMode: slot.anchorMode ?? null,
          anchorDays: slot.anchorDays ?? null,
          weight: slot.weight ?? 1,
          cooldownMs: slot.cooldownMs ?? 0,
          padMs: slot.padMs ?? null,
          padToMultiple: slot.padToMultiple ?? null,
          fillerConfig: slot.fillerConfig ?? null,
          createdAt: new Date(),
          updatedAt: new Date(),
          state: null,
          fillMode: 'fill',
          fillValue: null,
        })),
      } satisfies InfiniteScheduleWithSlotsAndState;

      const result = await generator.preview(
        scheduleForPreview,
        req.body.fromTimeMs,
        req.body.toTimeMs,
      );

      return res.send({
        items: result.items.map(generatedItemToApi),
        fromTimeMs: result.fromTimeMs,
        toTimeMs: result.toTimeMs,
      });
    },
  );

  /**
   * Force regenerate the schedule buffer
   */
  fastify.post(
    '/channels/:id/infinite-schedule/regenerate',
    {
      schema: {
        operationId: 'regenerateInfiniteSchedule',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        body: z.object({
          fromTimeMs: z.number().optional(),
          clearExisting: z.boolean().default(false),
        }),
        response: {
          200: z.object({
            itemsGenerated: z.number(),
            fromTimeMs: z.number(),
            toTimeMs: z.number(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      // Optionally clear existing items
      if (req.body.clearExisting) {
        await db.clearGeneratedItems(schedule.uuid);
      }

      const generator = getGenerator();
      const result = await generator.generate(
        schedule.uuid,
        req.body.fromTimeMs,
      );

      // Persist the generated items
      await db.insertGeneratedItems(result.items);

      // Update slot states
      for (const [slotUuid, stateUpdate] of result.slotStates) {
        await db.updateSlotState(slotUuid, stateUpdate);
      }

      return res.send({
        itemsGenerated: result.items.length,
        fromTimeMs: result.fromTimeMs,
        toTimeMs: result.toTimeMs,
      });
    },
  );

  /**
   * Reset all RNG seeds for a schedule
   */
  fastify.post(
    '/channels/:id/infinite-schedule/reset-seeds',
    {
      schema: {
        operationId: 'resetInfiniteScheduleSeeds',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        response: {
          200: z.object({ slotsReset: z.number() }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      const slotsReset = await db.resetSlotSeeds(schedule.uuid);
      return res.send({ slotsReset });
    },
  );

  /**
   * Get slot states for debugging
   */
  fastify.get(
    '/channels/:id/infinite-schedule/state',
    {
      schema: {
        operationId: 'getInfiniteScheduleState',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        response: {
          200: z.object({
            scheduleUuid: z.string(),
            slotStates: z.array(SlotStateSchema),
            bufferEndTimeMs: z.number().nullable(),
            itemCount: z.number(),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannelWithState(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      const bufferEndTimeMs = await db.getBufferEndTime(schedule.uuid);
      const itemCount = await db.countGeneratedItems(schedule.uuid);

      return res.send({
        scheduleUuid: schedule.uuid,
        slotStates: schedule.slots.map((slot) => ({
          slotUuid: slot.uuid,
          slotIndex: slot.slotIndex,
          slotType: slot.slotType,
          state: slot.state,
        })),
        bufferEndTimeMs,
        itemCount,
      });
    },
  );

  /**
   * Get generated items for a time range
   */
  fastify.get(
    '/channels/:id/infinite-schedule/items',
    {
      schema: {
        operationId: 'getInfiniteScheduleItems',
        tags: ['Channels', 'Infinite Schedule'],
        params: ChannelIdParamSchema,
        querystring: z.object({
          fromTimeMs: z.coerce.number(),
          toTimeMs: z.coerce.number(),
        }),
        response: {
          200: z.object({
            items: z.array(GeneratedScheduleItemSchema),
          }),
          404: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      const items = await db.getGeneratedItems(
        schedule.uuid,
        req.query.fromTimeMs,
        req.query.toTimeMs,
      );

      return res.send({ items: items.map(generatedItemToApi) });
    },
  );

  /**
   * Delete a specific slot from the schedule
   */
  fastify.delete(
    '/channels/:id/infinite-schedule/slots/:slotId',
    {
      schema: {
        operationId: 'deleteInfiniteScheduleSlot',
        tags: ['Channels', 'Infinite Schedule'],
        params: SlotIdParamSchema,
        response: {
          200: z.object({ success: z.boolean() }),
          404: z.object({ error: z.string() }),
          501: z.object({ error: z.string() }),
        },
      },
    },
    async (req, res) => {
      const channel = await req.serverCtx.channelDB.getChannel(req.params.id);
      if (isNil(channel)) {
        return res.status(404).send({ error: 'Channel not found' });
      }

      const db = getInfiniteScheduleDB();
      const schedule = await db.getScheduleByChannel(channel.uuid);

      if (isNil(schedule)) {
        return res.status(404).send({ error: 'Infinite schedule not found' });
      }

      // For now, slots must be deleted by updating the schedule with new slots array
      // This is because slot deletion requires re-indexing and state management
      return res.status(501).send({
        error:
          'Individual slot deletion not implemented. Update the schedule with the new slots array instead.',
      });
    },
  );
};
