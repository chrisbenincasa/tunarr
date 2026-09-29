import { eq, or } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { EntityGenre, Genre } from '../db/schema/Genre.ts';
import type { DrizzleDBAccess } from '../db/schema/index.ts';
import { ProgramGrouping } from '../db/schema/ProgramGrouping.ts';
import { KEYS } from '../types/inject.ts';
import type { StreamSelectionCelContext } from './CelEvaluationService.ts';

export type StreamSelectionProgramRef = {
  uuid: string;
  title: string;
  type: string;
  libraryId?: string | null;
  tvShowUuid?: string | null;
};

/**
 * Builds the `program` part of the stream selection CEL context. Episodes
 * also get their show's title, and their genres include the show's genres,
 * because media servers usually tag genres on the show rather than on each
 * episode.
 */
@injectable()
export class StreamSelectionProgramContextLoader {
  constructor(@inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess) {}

  async load(
    program: StreamSelectionProgramRef,
  ): Promise<StreamSelectionCelContext['program']> {
    const showId =
      program.type === 'episode'
        ? (program.tvShowUuid ?? undefined)
        : undefined;

    const [genreRows, showRows] = await Promise.all([
      this.drizzle
        .selectDistinct({ name: Genre.name })
        .from(EntityGenre)
        .innerJoin(Genre, eq(EntityGenre.genreId, Genre.uuid))
        .where(
          showId
            ? or(
                eq(EntityGenre.programId, program.uuid),
                eq(EntityGenre.groupId, showId),
              )
            : eq(EntityGenre.programId, program.uuid),
        ),
      showId
        ? this.drizzle
            .select({ title: ProgramGrouping.title })
            .from(ProgramGrouping)
            .where(eq(ProgramGrouping.uuid, showId))
            .limit(1)
        : Promise.resolve([]),
    ]);

    return {
      title: program.title,
      type: program.type,
      showTitle: showRows[0]?.title ?? '',
      genres: genreRows.map((row) => row.name),
      libraryId: program.libraryId ?? '',
    };
  }
}
