import { KEYS } from '@/types/inject.js';
import { seq } from '@tunarr/shared/util';
import { and, eq, inArray, sql } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { chunk, difference, groupBy, isNil, keys, partition } from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import { groupByUniq, isDefined, isNonEmptyString } from '../../util/index.ts';
import { Artwork, type NewArtwork } from '../schema/Artwork.ts';
import { Credit, type NewCredit } from '../schema/Credit.ts';
import {
  EntityGenre,
  Genre,
  type NewGenre,
  type NewGenreEntity,
} from '../schema/Genre.ts';
import {
  NewProgramSubtitles,
  ProgramSubtitles,
} from '../schema/ProgramSubtitles.ts';
import {
  NewStudio,
  NewStudioEntity,
  Studio,
  StudioEntity,
} from '../schema/Studio.ts';
import { NewTag, NewTagRelation, Tag, TagRelations } from '../schema/Tag.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';

@injectable()
export class ProgramMetadataRepository {
  constructor(@inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess) {}

  async upsertArtwork(artwork: NewArtwork[]) {
    if (artwork.length === 0) {
      return;
    }

    const programArt = groupBy(
      artwork.filter((art) => isNonEmptyString(art.programId)),
      (art) => art.programId,
    );
    const groupArt = groupBy(
      artwork.filter((art) => isNonEmptyString(art.groupingId)),
      (art) => art.groupingId,
    );
    const creditArt = groupBy(
      artwork.filter((art) => isNonEmptyString(art.creditId)),
      (art) => art.creditId,
    );

    return await this.drizzleDB.transaction(async (tx) => {
      for (const batch of chunk(keys(programArt), 50)) {
        await tx.delete(Artwork).where(inArray(Artwork.programId, batch));
      }
      for (const batch of chunk(keys(groupArt), 50)) {
        await tx.delete(Artwork).where(inArray(Artwork.groupingId, batch));
      }
      for (const batch of chunk(keys(creditArt), 50)) {
        await tx.delete(Artwork).where(inArray(Artwork.creditId, batch));
      }
      const inserted: Artwork[] = [];
      for (const batch of chunk(artwork, 50)) {
        const batchResult = await this.drizzleDB
          .insert(Artwork)
          .values(batch)
          .onConflictDoUpdate({
            target: Artwork.uuid,
            set: {
              cachePath: sql`excluded.cache_path`,
              groupingId: sql`excluded.grouping_id`,
              programId: sql`excluded.program_id`,
              updatedAt: sql`excluded.updated_at`,
              sourcePath: sql`excluded.source_path`,
            },
          })
          .returning();
        inserted.push(...batchResult);
      }
      return inserted;
    });
  }

  async upsertProgramGenres(programId: string, genres: NewGenre[]) {
    return this.upsertProgramGenresInternal('program', programId, genres);
  }

  async upsertProgramGroupingGenres(groupingId: string, genres: NewGenre[]) {
    return this.upsertProgramGenresInternal('grouping', groupingId, genres);
  }

  private async upsertProgramGenresInternal(
    entityType: 'program' | 'grouping',
    joinId: string,
    genres: NewGenre[],
  ) {
    if (genres.length === 0) {
      return;
    }

    const incomingByName = groupByUniq(genres, (g) => g.name);
    const existingGenresByName: Dictionary<Genre> = {};
    for (const genreChunk of chunk(genres, 100)) {
      const names = genreChunk.map((g) => g.name);
      const results = await this.drizzleDB
        .select()
        .from(Genre)
        .where(inArray(Genre.name, names));
      for (const result of results) {
        existingGenresByName[result.name] = result;
      }
    }

    const newGenreNames = new Set(
      difference(keys(incomingByName), keys(existingGenresByName)),
    );

    const relations: NewGenreEntity[] = [];
    for (const name of Object.keys(incomingByName)) {
      const genreId = newGenreNames.has(name)
        ? incomingByName[name]!.uuid
        : existingGenresByName[name]!.uuid;
      relations.push({
        genreId,
        programId: entityType === 'program' ? joinId : null,
        groupId: entityType === 'grouping' ? joinId : null,
      });
    }

    return this.drizzleDB.transaction(async (tx) => {
      const col =
        entityType === 'grouping' ? EntityGenre.groupId : EntityGenre.programId;
      await tx.delete(EntityGenre).where(eq(col, joinId));
      if (newGenreNames.size > 0) {
        await tx
          .insert(Genre)
          .values(
            [...newGenreNames.values()].map((name) => incomingByName[name]!),
          )
          .onConflictDoNothing();
      }
      if (relations.length > 0) {
        await tx.insert(EntityGenre).values(relations).onConflictDoNothing();
      }
    });
  }

  async upsertProgramStudios(programId: string, studios: NewStudio[]) {
    return this.upsertProgramStudiosInternal('program', programId, studios);
  }

  async upsertProgramGroupingStudios(groupingId: string, studios: NewStudio[]) {
    return this.upsertProgramStudiosInternal('grouping', groupingId, studios);
  }

  private async upsertProgramStudiosInternal(
    entityType: 'program' | 'grouping',
    joinId: string,
    studios: NewStudio[],
  ) {
    if (studios.length === 0) {
      return;
    }

    const incomingByName = groupByUniq(studios, (g) => g.name);
    const existingStudiosByName: Dictionary<Studio> = {};
    for (const studioChunk of chunk(studios, 100)) {
      const names = studioChunk.map((g) => g.name);
      const results = await this.drizzleDB
        .select()
        .from(Studio)
        .where(inArray(Studio.name, names));
      for (const result of results) {
        existingStudiosByName[result.name] = result;
      }
    }

    const newStudioNames = new Set(
      difference(keys(incomingByName), keys(existingStudiosByName)),
    );

    const relations: NewStudioEntity[] = [];
    for (const name of Object.keys(incomingByName)) {
      const studioId = newStudioNames.has(name)
        ? incomingByName[name]!.uuid
        : existingStudiosByName[name]!.uuid;
      relations.push({
        studioId,
        programId: entityType === 'program' ? joinId : null,
        groupId: entityType === 'grouping' ? joinId : null,
      });
    }

    return this.drizzleDB.transaction(async (tx) => {
      const col =
        entityType === 'grouping'
          ? StudioEntity.groupId
          : StudioEntity.programId;
      await tx.delete(StudioEntity).where(eq(col, joinId));
      if (newStudioNames.size > 0) {
        await tx
          .insert(Studio)
          .values(
            [...newStudioNames.values()].map((name) => incomingByName[name]!),
          )
          .onConflictDoNothing();
      }
      if (relations.length > 0) {
        await tx.insert(StudioEntity).values(relations).onConflictDoNothing();
      }
    });
  }

  async upsertProgramTags(programId: string, tags: NewTag[]) {
    return this.upsertProgramTagsInternal('program', programId, tags);
  }

  async upsertProgramGroupingTags(groupingId: string, tags: NewTag[]) {
    return this.upsertProgramTagsInternal('grouping', groupingId, tags);
  }

  private async upsertProgramTagsInternal(
    entityType: 'program' | 'grouping',
    joinId: string,
    tags: NewTag[],
  ) {
    if (tags.length === 0) {
      return;
    }

    const incomingByName = groupByUniq(tags, (g) => g.tag);
    const existingTagsByName: Dictionary<Tag> = {};
    for (const tagChunk of chunk(tags, 100)) {
      const names = tagChunk.map((g) => g.tag);
      const results = await this.drizzleDB
        .select()
        .from(Tag)
        .where(inArray(Tag.tag, names));
      for (const result of results) {
        existingTagsByName[result.tag] = result;
      }
    }

    const newTagNames = new Set(
      difference(keys(incomingByName), keys(existingTagsByName)),
    );

    const relations: NewTagRelation[] = [];
    for (const name of Object.keys(incomingByName)) {
      const tagId = newTagNames.has(name)
        ? incomingByName[name]!.uuid
        : existingTagsByName[name]!.uuid;
      relations.push({
        tagId,
        programId: entityType === 'program' ? joinId : null,
        groupingId: entityType === 'grouping' ? joinId : null,
        source: 'media',
      });
    }

    return this.drizzleDB.transaction(async (tx) => {
      const col =
        entityType === 'grouping'
          ? TagRelations.groupingId
          : TagRelations.programId;
      await tx
        .delete(TagRelations)
        .where(and(eq(col, joinId), eq(TagRelations.source, 'media')));
      if (newTagNames.size > 0) {
        await tx
          .insert(Tag)
          .values(
            [...newTagNames.values()].map((name) => incomingByName[name]!),
          )
          .onConflictDoNothing();
      }
      if (relations.length > 0) {
        await tx.insert(TagRelations).values(relations).onConflictDoNothing();
      }
    });
  }

  async upsertSubtitles(subtitles: NewProgramSubtitles[]) {
    if (subtitles.length === 0) {
      return;
    }

    const grouped = groupBy(subtitles, (sub) => sub.programId);
    for (const [programId, programSubtitles] of Object.entries(grouped)) {
      const existingSubsForProgram =
        await this.drizzleDB.query.programSubtitles.findMany({
          where: (fields, { eq }) => eq(fields.programId, programId),
        });

      const [existingEmbedded, _] = partition(
        existingSubsForProgram,
        (sub) => !isNil(sub.streamIndex),
      );
      const [incomingEmbedded, incomingExternal] = partition(
        programSubtitles,
        (sub) => !isNil(sub.streamIndex),
      );

      const existingIndexes = new Set(
        seq.collect(existingEmbedded, (sub) => sub.streamIndex),
      );
      const incomingIndexes = new Set(
        seq.collect(incomingEmbedded, (sub) => sub.streamIndex),
      );

      const newIndexes = incomingIndexes.difference(existingIndexes);
      const removedIndexes = existingIndexes.difference(newIndexes);
      const updatedIndexes = incomingIndexes.difference(
        newIndexes.union(removedIndexes),
      );

      const inserts = incomingEmbedded.filter((s) =>
        newIndexes.has(s.streamIndex!),
      );
      const removes = existingEmbedded.filter((s) =>
        removedIndexes.has(s.streamIndex!),
      );

      const updates: ProgramSubtitles[] = [];
      for (const updatedIndex of updatedIndexes.values()) {
        const incoming = incomingEmbedded.find(
          (s) => s.streamIndex === updatedIndex,
        );
        const existing = existingEmbedded.find(
          (s) => s.streamIndex === updatedIndex,
        );
        if (!existing || !incoming) {
          continue;
        }

        if (existing.isExtracted) {
          const needsExtraction =
            existing.subtitleType !== incoming.subtitleType ||
            existing.codec !== incoming.subtitleType ||
            existing.language !== incoming.language ||
            existing.forced !== incoming.forced ||
            existing.sdh !== incoming.sdh ||
            existing.default !== incoming.default;
          if (needsExtraction) {
            existing.isExtracted = false;
            existing.path = incoming.path ?? null;
          } else if (
            isNonEmptyString(incoming.path) &&
            existing.path !== incoming.path
          ) {
            existing.isExtracted = false;
            existing.path = incoming.path;
          }
        }

        existing.codec = incoming.codec;
        existing.language = incoming.language;
        existing.subtitleType = incoming.subtitleType;
        existing.updatedAt = incoming.updatedAt;
        if (isDefined(incoming.default)) {
          existing.default = incoming.default;
        }

        if (isDefined(incoming.sdh)) {
          existing.sdh = incoming.sdh;
        }

        if (isDefined(incoming.forced)) {
          existing.forced = incoming.forced;
        }

        updates.push(existing);
      }

      await this.drizzleDB.transaction(async (tx) => {
        if (inserts.length > 0) {
          await tx.insert(ProgramSubtitles).values(inserts);
        }
        if (removes.length > 0) {
          await tx.delete(ProgramSubtitles).where(
            inArray(
              ProgramSubtitles.uuid,
              removes.map((s) => s.uuid),
            ),
          );
        }

        if (updates.length > 0) {
          for (const update of updates) {
            await tx
              .update(ProgramSubtitles)
              .set(update)
              .where(eq(ProgramSubtitles.uuid, update.uuid));
          }
        }

        await tx
          .delete(ProgramSubtitles)
          .where(
            and(
              eq(ProgramSubtitles.subtitleType, 'sidecar'),
              eq(ProgramSubtitles.programId, programId),
            ),
          );

        if (incomingExternal.length > 0) {
          await tx.insert(ProgramSubtitles).values(incomingExternal);
        }
      });
    }
  }

  async upsertCredits(credits: NewCredit[]) {
    if (credits.length === 0) {
      return;
    }

    const programCredits = groupBy(
      credits.filter((credit) => isNonEmptyString(credit.programId)),
      (credit) => credit.programId,
    );
    const groupCredits = groupBy(
      credits.filter((credit) => isNonEmptyString(credit.groupingId)),
      (credit) => credit.groupingId,
    );

    return await this.drizzleDB.transaction(async (tx) => {
      for (const batch of chunk(keys(programCredits), 50)) {
        await tx.delete(Credit).where(inArray(Credit.programId, batch));
      }
      for (const batch of chunk(keys(groupCredits), 50)) {
        await tx.delete(Credit).where(inArray(Credit.groupingId, batch));
      }
      const inserted: Credit[] = [];
      for (const batch of chunk(credits, 50)) {
        const batchResult = await this.drizzleDB
          .insert(Credit)
          .values(batch)
          .returning();
        inserted.push(...batchResult);
      }
      return inserted;
    });
  }
}
