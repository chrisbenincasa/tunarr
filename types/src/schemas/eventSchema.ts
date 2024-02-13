import { z } from 'zod';

export const EventTypeSchema = z.union([
  z.literal('heartbeat'),
  z.literal('lifecycle'),
  z.literal('xmltv'),
  z.literal('settings-update'),
]);

const BaseEventSchema = z.object({
  message: z.string().optional(),
  level: z.union([
    z.literal('info'),
    z.literal('success'),
    z.literal('warning'),
    z.literal('error'),
  ]),
});

export const SettingsUpdateEventSchema = BaseEventSchema.extend({
  type: z.literal('settings-update'),
  module: z.string(),
  detail: z.object({
    action: z.union([
      z.literal('reset'),
      z.literal('update'),
      z.literal('action'),
      z.literal('delete'),
      z.literal('add'),
    ]),
    error: z.string().optional(),
    serverName: z.string().optional(),
    serverId: z.string().optional(),
  }),
});

export const HeartbeatEventSchema = BaseEventSchema.extend({
  type: z.literal('heartbeat'),
});

export const XmlTvEventSchema = BaseEventSchema.extend({
  type: z.literal('xmltv'),
  module: z.string(),
  detail: z.object({
    time: z.number(),
  }),
});

export const LifecycleEventSchema = BaseEventSchema.extend({
  type: z.literal('lifecycle'),
  detail: z.object({
    time: z.number(),
  }),
});

export const TunarrEventSchema = z.discriminatedUnion('type', [
  SettingsUpdateEventSchema,
  HeartbeatEventSchema,
  LifecycleEventSchema,
  XmlTvEventSchema,
]);
