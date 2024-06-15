import { z } from 'zod';

// When we have these, we can implement them.
export const GlobalExternalSourceSchema = z.never();

// Represents an external ID that has a single
// source-of-truth (i.e. the 'id' field is global)
// to the source, e.g. IMDB
export const GlobalExternalIdSchema = z.object({
  type: z.literal('single'),
  source: GlobalExternalSourceSchema,
  id: z.string(),
});

// When we have more sources, this will be a union
export const MultiExternalSourceSchema = z.literal('plex');

// Represents components of an ID that can be
// used to address an object (program or grouping) in
// an external source  e.g. Plex. This differs from
// a GlobalExternalId in that there is not a 'single'
// source; we include the sourceId to know which
// 'source' to address, e.g. Plex server ID
export const MultiExternalIdSchema = z.object({
  type: z.literal('multi'),
  // The source type of the ID
  source: MultiExternalSourceSchema,
  sourceId: z.string(),
  id: z.string(),
});

// ExternalIds are either global or multi IDs.
export const ExternalIdSchema = z.discriminatedUnion('type', [
  GlobalExternalIdSchema,
  MultiExternalIdSchema,
]);

export const ChannelIconSchema = z.object({
  path: z.string().catch(''),
  width: z.number().nonnegative().catch(0),
  duration: z.number().catch(0),
  position: z
    .union([
      z.literal('top-left'),
      z.literal('top-right'),
      z.literal('bottom-left'),
      z.literal('bottom-right'),
    ])
    .catch('bottom-right'),
});

export const TimeUnitSchema = z.union([
  z.literal('second'),
  z.literal('minute'),
  z.literal('hour'),
  z.literal('day'),
  z.literal('week'),
]);

export const CronScheduleSchema = z.object({
  type: z.literal('cron'),
  cron: z.string(),
});

export const EveryScheduleSchema = z.object({
  type: z.literal('every'),
  increment: z.number().positive(),
  unit: TimeUnitSchema,
  offsetMs: z
    .number()
    .min(0)
    .max(1000 * 60 * 60 * 24 - 1)
    .default(0),
});

export type EverySchedule = z.infer<typeof EveryScheduleSchema>;

export const ScheduleSchema = z.discriminatedUnion('type', [
  CronScheduleSchema,
  EveryScheduleSchema,
]);
