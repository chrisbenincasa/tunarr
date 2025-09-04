import {
  DynamicContentConfigSchema,
  LineupScheduleSchema,
  SchedulingOperationSchema,
} from '@tunarr/types/api';
import { FillerType } from '@tunarr/types/schemas';
import { first } from 'lodash-es';
import { z } from 'zod/v4';

const BaseLineupItemSchema = z.object({
  durationMs: z.number().positive(), // Add a max
});

export const ContentLineupItemSchema = z
  .object({
    type: z.literal('content'),
    id: z.string().min(1),
    // If this lineup item was a part of a custom show
    // this is a pointer to that show.
    // TODO: If a custom show is deleted, we have to remove
    // references to these content items in the lineup
    customShowId: z.uuid().optional(),
    fillerListId: z.uuid().optional(),
    fillerType: FillerType.optional(),
  })
  .merge(BaseLineupItemSchema);

// This item has to be hydrated from the DB
export type ContentItem = z.infer<typeof ContentLineupItemSchema>;

export const OfflineLineupItemSchema = z
  .object({
    type: z.literal('offline'),
  })
  .merge(BaseLineupItemSchema);

export type OfflineItem = z.infer<typeof OfflineLineupItemSchema>;

export const RedirectLineupItemSchema = z
  .object({
    type: z.literal('redirect'),
    channel: z.uuid(),
  })
  .merge(BaseLineupItemSchema);
export type RedirectItem = z.infer<typeof RedirectLineupItemSchema>;

export const LineupItemSchema = z.discriminatedUnion('type', [
  ContentLineupItemSchema,
  OfflineLineupItemSchema,
  RedirectLineupItemSchema,
]);

export type LineupItem = z.infer<typeof LineupItemSchema>;

function isItemOfType<T extends LineupItem>(discrim: string) {
  return function (t: LineupItem | undefined): t is T {
    return t?.type === discrim;
  };
}

export const isContentItem = isItemOfType<ContentItem>('content');
export const isOfflineItem = isItemOfType<OfflineItem>('offline');
export const isRedirectItem = isItemOfType<RedirectItem>('redirect');

const PendingProgramSchema = ContentLineupItemSchema.extend({
  updaterId: z.string(),
  addedAt: z.number(),
});

export type PendingProgram = z.infer<typeof PendingProgramSchema>;

export const OnDemandChannelConfigSchema = z.object({
  state: z
    .union([z.literal('paused'), z.literal('playing')])
    .default('paused')
    .catch('paused'),
  // Timestamp. Empty implies the channel has never been played
  lastResumed: z.number().positive().optional(),
  lastPaused: z.number().positive().optional(),
  cursor: z.number().nonnegative().default(0).catch(0),
});

export type OnDemandChannelConfig = z.infer<typeof OnDemandChannelConfigSchema>;

export const CurrentLineupSchemaVersion = 4;

export const LineupSchema = z.object({
  version: z
    .number()
    .min(1)
    // .default(CurrentLineupSchemaVersion)
    .catch(({ error }) => {
      // Initialize undefined versions at 0 to force migrations
      const issue = first(error.issues);
      if (
        first(issue?.path) === 'version' &&
        issue?.code === 'invalid_type' &&
        issue?.input === undefined
      ) {
        return 0;
      }
      return CurrentLineupSchemaVersion;
    }),
  // The last time the lineup was updated. For migration, this is defaulted
  // to when the config is loaded from disk on startup.
  lastUpdated: z.number().catch(() => new Date().getTime()),

  // The current lineup of a single cycle of this channel
  items: LineupItemSchema.readonly().array().readonly(),

  // Defines rules for how to schedule content in the channel
  // Currently time-based and random-slot-based rulesets are
  // supported.
  // Unsure if we want this DB type to reference the
  // API type, but for now it will work.
  schedule: LineupScheduleSchema.optional(),

  // These are precalculated offsets in milliseconds. The
  // array is a list of the running 'total' duration sum
  // of each of the lineup items. It can be used to quickly
  // determine a start timestamp for a given program by
  // pulling the offset at a given index and adding it to
  // a "start" time timestamp.
  startTimeOffsets: z.array(z.number()),

  //
  dynamicContentConfig: DynamicContentConfigSchema.optional(),

  // Pending items are items that were found by dynamic content
  // updaters. They are a listing of the 'next' set of programs
  // that will be part of a channel once the channel's schedule is
  // updated.
  pendingPrograms: z.array(PendingProgramSchema).optional(),

  schedulingOperations: z
    .array(SchedulingOperationSchema)
    .nonempty()
    .optional(),

  // OnDemand configuration for this channel. If empty, the channel
  // is not configured as on-demand.
  onDemandConfig: OnDemandChannelConfigSchema.optional(),
});

export type Lineup = z.infer<typeof LineupSchema>;
