import { inject, injectable } from 'inversify';
import { JSONPath } from 'jsonpath-plus';
import { isArray, isString, orderBy, uniq, uniqBy } from 'lodash-es';
import { v5 } from 'uuid';
import { z } from 'zod/v4';
import { CustomShowDB } from '../../db/CustomShowDB.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import type { ProgramOrm } from '../../db/schema/Program.ts';
import { getProgramOrderer } from '../../services/scheduling/ProgramIterator.ts';
import { KEYS } from '../../types/inject.ts';
import type { JsonObject } from '../../types/schemas.ts';
import { isJsonObject } from '../../types/schemas.ts';
import { InjectLogger } from '../../util/inject.ts';
import type { Logger } from '../../util/logging/LoggerFactory.ts';
import type { ChannelLineupMigrationContext } from './ChannelLineupMigration.ts';
import { ChannelLineupMigration } from './ChannelLineupMigration.ts';

// The v6 movie slot fields this migration reads. Kept local so the migration
// keeps working after the movie slot types are removed.
const MovieSlotSchema = z.object({
  type: z.literal('movie'),
  order: z.enum([
    'next',
    'shuffle',
    'ordered_shuffle',
    'alphanumeric',
    'chronological',
  ]),
  direction: z.enum(['asc', 'desc']).optional(),
});

type MovieSlot = z.infer<typeof MovieSlotSchema>;

// Namespace for the IDs of custom shows this migration creates. Never change
// it, or reruns stop finding shows created by earlier attempts.
const MigratedShowNamespace = 'dadaef0e-568d-4a60-a8d2-1c2c3b567e25';

const MoviePoolTypes = new Set<string>(['movie', 'music_video', 'other_video']);

type ShowSort = {
  sortBy: 'date' | 'title';
  direction: 'asc' | 'desc';
};

const ShowSortLabels: Record<string, string> = {
  date_asc: 'Oldest First',
  date_desc: 'Newest First',
  title_asc: 'A-Z',
  title_desc: 'Z-A',
};

function showSortKey(sort: ShowSort) {
  return `${sort.sortBy}_${sort.direction}`;
}

// Shuffle slots return undefined because any show order works for them.
function showSortForSlot(slot: MovieSlot): ShowSort | undefined {
  const direction = slot.direction ?? 'asc';
  switch (slot.order) {
    case 'next':
    case 'chronological':
    case 'ordered_shuffle':
      return { sortBy: 'date', direction };
    case 'alphanumeric':
      return { sortBy: 'title', direction };
    case 'shuffle':
      return;
  }
}

function customShowSlotOrder(order: MovieSlot['order']) {
  switch (order) {
    case 'next':
    case 'chronological':
    case 'alphanumeric':
      return 'next';
    case 'shuffle':
      return 'shuffle';
    case 'ordered_shuffle':
      return 'ordered_shuffle';
  }
}

/**
 * Replaces movie slots with custom-show slots. Each distinct sort gets a
 * custom show built from the channel's saved movies, sorted the way the movie
 * slot would have played them. The show is a snapshot and does not pick up
 * movies added to the channel later.
 */
@injectable()
export class MovieSlotToCustomShowMigration extends ChannelLineupMigration<
  6,
  7
> {
  @InjectLogger() declare private readonly logger: Logger;

  readonly from = 6;
  readonly to = 7;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(CustomShowDB) private customShowDB: CustomShowDB,
  ) {
    super();
  }

  async migrate(
    lineup: JsonObject,
    context?: ChannelLineupMigrationContext,
  ): Promise<void> {
    const schedule = lineup['schedule'];
    if (!isJsonObject(schedule) || !isArray(schedule['slots'])) {
      return;
    }

    const movieSlots: { raw: JsonObject; slot: MovieSlot }[] = [];
    for (const raw of schedule['slots']) {
      if (!isJsonObject(raw)) {
        continue;
      }
      const parsed = MovieSlotSchema.safeParse(raw);
      if (parsed.success) {
        movieSlots.push({ raw, slot: parsed.data });
      }
    }

    if (movieSlots.length === 0) {
      return;
    }

    if (!context) {
      throw new Error(
        'MovieSlotToCustomShowMigration needs a channel ID to build custom shows',
      );
    }

    const channel = await this.drizzle.query.channels.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, context.channelId),
      columns: { name: true },
    });
    if (!channel) {
      throw new Error(`Channel ${context.channelId} not found`);
    }

    const pool = await this.loadMoviePool(context.channelId, lineup, schedule);

    if (pool.length === 0) {
      this.logger.warn(
        'Channel %s has %d movie slot(s) but no movies to schedule. Converting them to flex slots.',
        context.channelId,
        movieSlots.length,
      );
      for (const { raw } of movieSlots) {
        raw['type'] = 'flex';
        delete raw['order'];
        delete raw['direction'];
        delete raw['filler'];
        delete raw['midRoll'];
      }
      return;
    }

    const sorts = new Map<string, ShowSort>();
    for (const { slot } of movieSlots) {
      const sort = showSortForSlot(slot);
      if (sort) {
        sorts.set(showSortKey(sort), sort);
      }
    }
    if (sorts.size === 0) {
      const sort: ShowSort = { sortBy: 'date', direction: 'asc' };
      sorts.set(showSortKey(sort), sort);
    }

    const showIdBySortKey = new Map<string, string>();
    for (const [key, sort] of sorts) {
      const name =
        sorts.size === 1
          ? `${channel.name} Movies`
          : `${channel.name} Movies (${ShowSortLabels[key]})`;
      showIdBySortKey.set(
        key,
        await this.findOrCreateShow(
          context.channelId,
          key,
          name,
          sortPool(pool, sort),
        ),
      );
    }

    const [fallbackShowId] = showIdBySortKey.values();
    for (const { raw, slot } of movieSlots) {
      const sort = showSortForSlot(slot);
      const showId = sort
        ? showIdBySortKey.get(showSortKey(sort))
        : fallbackShowId;
      if (!showId) {
        throw new Error(`No custom show built for movie slot ${slot.order}`);
      }

      // Custom-show slots play the show in its stored order and ignore
      // direction. The direction is baked into the show instead.
      raw['type'] = 'custom-show';
      raw['customShowId'] = showId;
      raw['order'] = customShowSlotOrder(slot.order);
      raw['direction'] = 'asc';
    }

    this.logger.info(
      'Converted %d movie slot(s) on channel %s to custom-show slots',
      movieSlots.length,
      context.channelId,
    );
  }

  /**
   * The channel's saved movies, minus programs that are filler. A program is
   * filler if it belongs to a filler list the schedule uses, or if the lineup
   * only ever plays it as filler.
   */
  private async loadMoviePool(
    channelId: string,
    lineup: JsonObject,
    schedule: JsonObject,
  ): Promise<ProgramOrm[]> {
    const channelPrograms = await this.drizzle.query.channelPrograms.findMany({
      where: (fields, { eq }) => eq(fields.channelUuid, channelId),
      with: { program: true },
    });

    const movies = uniqBy(
      channelPrograms
        .map(({ program }) => program)
        .filter((program) => MoviePoolTypes.has(program.type)),
      (program) => program.uuid,
    );

    const excluded = new Set([
      ...lineupOnlyFillerIds(lineup),
      ...(await this.fillerListProgramIds(schedule)),
    ]);

    return movies.filter((program) => !excluded.has(program.uuid));
  }

  private async fillerListProgramIds(schedule: JsonObject) {
    const fillerListIds = uniq(
      JSONPath<unknown[]>({ path: '$..fillerListId', json: schedule }).filter(
        isString,
      ),
    );
    if (fillerListIds.length === 0) {
      return [];
    }

    const rows = await this.drizzle.query.fillerShowContent.findMany({
      where: (fields, { inArray }) =>
        inArray(fields.fillerShowUuid, fillerListIds),
      columns: { programUuid: true },
    });
    return rows.map(({ programUuid }) => programUuid);
  }

  // The show ID derives from the channel and sort, so a rerun after a failed
  // lineup save reuses the show it created. Names are not unique, so a name
  // lookup could pick up another channel's show or one the user made.
  private async findOrCreateShow(
    channelId: string,
    sortKey: string,
    name: string,
    programs: ProgramOrm[],
  ) {
    const uuid = v5(`${channelId}:${sortKey}`, MigratedShowNamespace);
    const existing = await this.drizzle.query.customShow.findFirst({
      where: (fields, { eq }) => eq(fields.uuid, uuid),
      columns: { uuid: true },
    });
    if (existing) {
      this.logger.info('Reusing custom show %s ("%s")', uuid, name);
      return existing.uuid;
    }

    return this.customShowDB.createShow(
      {
        name,
        programs: programs.map((program) => ({
          type: 'content',
          id: program.uuid,
          duration: program.duration,
        })),
        syncMediaSourceId: null,
        syncMediaSourceType: null,
        syncExternalPlaylistId: null,
      },
      uuid,
    );
  }
}

function lineupOnlyFillerIds(lineup: JsonObject) {
  const items = lineup['items'];
  if (!isArray(items)) {
    return [];
  }

  const fillerIds = new Set<string>();
  const contentIds = new Set<string>();
  for (const item of items) {
    if (
      !isJsonObject(item) ||
      item['type'] !== 'content' ||
      !isString(item['id'])
    ) {
      continue;
    }
    if (
      item['fillerListId'] !== undefined ||
      item['fillerType'] !== undefined
    ) {
      fillerIds.add(item['id']);
    } else {
      contentIds.add(item['id']);
    }
  }

  return [...fillerIds].filter((id) => !contentIds.has(id));
}

// Sorts with the slot scheduler's own orderers so the show plays in the same
// order the movie slot did.
function sortPool(pool: ProgramOrm[], sort: ShowSort): ProgramOrm[] {
  const orderer = getProgramOrderer(
    sort.sortBy === 'title' ? 'alphanumeric' : 'next',
  );
  return orderBy(
    pool,
    (program) =>
      orderer({
        ...program,
        parentFillerLists: [],
        parentCustomShows: [],
        parentSmartCollections: [],
      }),
    [sort.direction],
  );
}
