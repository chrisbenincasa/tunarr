import { SlotScheduleResult, TimeSlotScheduleResult } from '@tunarr/types/api';
import { z } from 'zod/v4';
import {
  ChannelSlotScheduleRequest,
  ProgramsSlotScheduleRequest,
} from '../services/scheduling/RandomSlotSchedulerService.ts';
import {
  ChannelTimeSlotScheduleRequest,
  ProgramsTimeSlotScheduleRequest,
} from '../services/scheduling/TimeSlotSchedulerService.ts';

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

export const WorkerScheduleTimeSlotsRequest = z.object({
  ...BaseWorkerRequest.shape,
  type: z.literal('time-slots'),
  request: z.discriminatedUnion('type', [
    ChannelTimeSlotScheduleRequest.omit({ materializeResult: true }),
    ProgramsTimeSlotScheduleRequest.omit({ materializeResult: true }),
  ]),
});

export type WorkerScheduleTimeSlotsRequest = z.infer<
  typeof WorkerScheduleTimeSlotsRequest
>;

export const WorkerScheduleSlotsRequest = z.object({
  ...BaseWorkerRequest.shape,
  type: z.literal('schedule-slots'),
  request: z.discriminatedUnion('type', [
    ChannelSlotScheduleRequest.omit({ materializeResult: true }),
    ProgramsSlotScheduleRequest.omit({ materializeResult: true }),
  ]),
});

export type WorkerScheduleSlotsRequest = z.infer<
  typeof WorkerScheduleSlotsRequest
>;

export const WorkerBuildGuideRequest = z.object({
  ...BaseWorkerRequest.shape,
  type: z.literal('build-guide'),
  channelId: z.string().optional(),
  guideDurationHours: z.number(),
  writeXmlTv: z.boolean().default(true),
  force: z.boolean().default(false),
  startTime: z.number().optional(),
});

export type WorkerBuildGuideRequest = z.infer<typeof WorkerBuildGuideRequest>;

export const WorkerRequest = z.discriminatedUnion('type', [
  WorkerRestartRequest,
  WorkerStatusRequest,
  WorkerScheduleTimeSlotsRequest,
  WorkerScheduleSlotsRequest,
  WorkerBuildGuideRequest,
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
  result: TimeSlotScheduleResult,
});

export type WorkerTimeSlotScheduleReply = z.infer<
  typeof WorkerTimeSlotScheduleReply
>;

export const WorkerSlotScheduleReply = z.object({
  type: z.literal('schedule-slots'),
  result: SlotScheduleResult,
});

export type WorkerSlotScheduleReply = z.infer<typeof WorkerSlotScheduleReply>;

export const WorkerBuildGuideReply = z.object({
  type: z.literal('build-guide'),
  result: z.void(),
});

export type WorkerStatusReply = z.infer<typeof WorkerStatusReply>;

export const WorkerSuccessReply = z.object({
  type: z.literal('success'),
  requestId: z.string(),
  data: z.discriminatedUnion('type', [
    WorkerStatusReply,
    WorkerTimeSlotScheduleReply,
    WorkerSlotScheduleReply,
    WorkerBuildGuideReply,
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
  'schedule-slots': WorkerSlotScheduleReply,
  'build-guide': z.void(),
} as const;
