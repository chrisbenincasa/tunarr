import { TimeSlotScheduleSchema } from '@tunarr/types/api';
import { ChannelProgramSchema } from '@tunarr/types/schemas';
import { z } from 'zod/v4';

export const BaseWorkerRequest = z.object({
  requestId: z.uuid(),
});

export const WorkerRestartRequest = BaseWorkerRequest.extend({
  type: z.literal('restart'),
  code: z.number().optional(),
});

export const WorkerStatusRequest = BaseWorkerRequest.extend({
  type: z.literal('status'),
});

export const WorkerScheduleTimeSlotsRequest = BaseWorkerRequest.extend({
  type: z.literal('time-slots'),
  channelId: z.uuid().or(z.number()),
  schedule: TimeSlotScheduleSchema,
});

export type WorkerScheduleTimeSlotsRequest = z.infer<
  typeof WorkerScheduleTimeSlotsRequest
>;

export const WorkerRequest = z.discriminatedUnion('type', [
  WorkerRestartRequest,
  WorkerStatusRequest,
  WorkerScheduleTimeSlotsRequest,
]);

export type WorkerRequest = z.infer<typeof WorkerRequest>;

export const WorkerStartedEvent = z.object({
  type: 'started',
});

export const WorkerEvent = z.object({
  type: z.literal('event'),
  eventType: z.enum(['started']),
  message: z.string().optional(),
});

export type WorkerEvent = z.infer<typeof WorkerEvent>;

export const WorkerErrorReply = z.object({
  type: z.literal('error'),
  message: z.string(),
  requestId: z.string(),
});

export const WorkerStatusReply = z.object({
  type: z.literal('status'),
  status: z.enum(['healthy']),
});

export const WorkerTimeSlotScheduleReply = z.object({
  type: z.literal('time-slots'),
  programs: ChannelProgramSchema.array(),
  startTime: z.number(),
});

export type WorkerTimeSlotScheduleReply = z.infer<
  typeof WorkerTimeSlotScheduleReply
>;

export type WorkerStatusReply = z.infer<typeof WorkerStatusReply>;

export const WorkerSuccessReply = z.object({
  type: z.literal('success'),
  requestId: z.string(),
  data: z.discriminatedUnion('type', [
    WorkerStatusReply,
    WorkerTimeSlotScheduleReply,
  ]),
});

export type WorkerSuccessReply = z.infer<typeof WorkerSuccessReply>;

export const WorkerReply = z.discriminatedUnion('type', [
  WorkerErrorReply,
  WorkerSuccessReply,
]);

export type WorkerReply = z.infer<typeof WorkerReply>;

export const WorkerMessage = z.discriminatedUnion('type', [
  WorkerEvent,
  WorkerReply,
]);

export const WorkerRequestToResponse = {
  status: WorkerStatusReply,
  restart: z.void(),
  'time-slots': WorkerTimeSlotScheduleReply,
} as const;
