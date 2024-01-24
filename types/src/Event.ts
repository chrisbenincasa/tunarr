import { z } from 'zod';
import {
  EventTypeSchema,
  HeartbeatEventSchema,
  LifecycleEventSchema,
  SettingsUpdateEventSchema,
  TunarrEventSchema,
  XmlTvEventSchema,
} from './schemas/eventSchema.js';

type Alias<T> = T & { _?: never };

export type EventType = z.infer<typeof EventTypeSchema>;
export type XmlTvEvent = Alias<z.infer<typeof XmlTvEventSchema>>;
export type SettingsUpdateEvent = Alias<
  z.infer<typeof SettingsUpdateEventSchema>
>;
export type HeartbeatEvent = Alias<z.infer<typeof HeartbeatEventSchema>>;
export type LifecycleEvent = Alias<z.infer<typeof LifecycleEventSchema>>;
export type TunarrEvent = Alias<z.infer<typeof TunarrEventSchema>>;

export type EventByType = {
  [K in EventType]: Extract<TunarrEvent, { type: K }>;
};
