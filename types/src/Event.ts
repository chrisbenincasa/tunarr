import type { z } from 'zod/v4';
import type {
  EventTypeSchema,
  HeartbeatEventSchema,
  LifecycleEventSchema,
  SettingsUpdateEventSchema,
  StreamSessionEventSchema,
  TunarrEventSchema,
  XmlTvEventSchema,
} from './schemas/eventSchema.js';

export type EventType = z.infer<typeof EventTypeSchema>;
export type XmlTvEvent = z.infer<typeof XmlTvEventSchema>;
export type SettingsUpdateEvent = z.infer<typeof SettingsUpdateEventSchema>;
export type HeartbeatEvent = z.infer<typeof HeartbeatEventSchema>;
export type LifecycleEvent = z.infer<typeof LifecycleEventSchema>;
export type TunarrEvent = z.infer<typeof TunarrEventSchema>;
export type StreamSessionEvent = z.infer<typeof StreamSessionEventSchema>;

export type EventByType = {
  [K in EventType]: Extract<TunarrEvent, { type: K }>;
};
