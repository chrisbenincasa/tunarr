import { KEYS } from '@/types/inject.js';
import type { MarkNonNullable, Maybe } from '@/types/util.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';

import { inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import {
  chunk,
  flatten,
  groupBy,
  head,
  isArray,
  isEmpty,
  omit,
} from 'lodash-es';
import type { Dictionary } from 'ts-essentials';
import { groupByUniq, unzip as myUnzip } from '../../util/index.ts';
import { ProgramUpsertSetClause } from '../programQueryHelpers.ts';
import type { NewArtwork } from '../schema/Artwork.ts';
import type { NewCredit } from '../schema/Credit.ts';
import type { NewGenre } from '../schema/Genre.ts';
import { Program, type ProgramDao } from '../schema/Program.ts';
import {
  ProgramChapter,
  type NewProgramChapter,
} from '../schema/ProgramChapter.ts';
import {
  ProgramMediaFile,
  type NewProgramMediaFile,
} from '../schema/ProgramMediaFile.ts';
import {
  ProgramMediaStream,
  type NewProgramMediaStream,
} from '../schema/ProgramMediaStream.ts';
import type { NewProgramSubtitles } from '../schema/ProgramSubtitles.ts';
import { ProgramVersion } from '../schema/ProgramVersion.ts';
import type { NewStudio } from '../schema/Studio.ts';
import type { NewTag } from '../schema/Tag.ts';
import type {
  NewProgramVersion,
  NewProgramWithRelations,
  ProgramWithExternalIds,
} from '../schema/derivedTypes.ts';
import type { DrizzleDBAccess } from '../schema/index.ts';
import { ProgramExternalIdRepository } from './ProgramExternalIdRepository.ts';
import { ProgramMetadataRepository } from './ProgramMetadataRepository.ts';

@injectable()
export class ProgramUpsertRepository {
  @InjectLogger() private declare readonly logger: Logger;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(KEYS.ProgramExternalIdRepository)
    private externalIdRepo: ProgramExternalIdRepository,
    @inject(KEYS.ProgramMetadataRepository)
    private metadataRepo: ProgramMetadataRepository,
  ) {}

  upsertPrograms(
    request: NewProgramWithRelations,
  ): Promise<ProgramWithExternalIds>;
  upsertPrograms(
    programs: NewProgramWithRelations[],
    programUpsertBatchSize?: number,
  ): Promise<ProgramWithExternalIds[]>;
  async upsertPrograms(
    requests: NewProgramWithRelations | NewProgramWithRelations[],
    programUpsertBatchSize: number = 100,
  ): Promise<ProgramWithExternalIds | ProgramWithExternalIds[]> {
    const wasSingleRequest = !isArray(requests);
    requests = isArray(requests) ? requests : [requests];
    if (isEmpty(requests)) {
      return [];
    }

    const requestsByCanonicalId = groupByUniq(
      requests,
      ({ program }) => program.canonicalId,
    );

    const result = await Promise.all(
      chunk(requests, programUpsertBatchSize).map(async (c) => {
        const chunkResult = this.drizzleDB.transaction((tx) =>
          tx
            .insert(Program)
            .values(c.map(({ program }) => program))
            .onConflictDoUpdate({
              target: [
                Program.sourceType,
                Program.mediaSourceId,
                Program.externalKey,
              ],
              set: ProgramUpsertSetClause,
            })
            .returning()
            .all(),
        ) as MarkNonNullable<ProgramDao, 'mediaSourceId' | 'canonicalId'>[];

        const allExternalIds = flatten(c.map((program) => program.externalIds));
        const versionsToInsert: NewProgramVersion[] = [];
        const artworkToInsert: NewArtwork[] = [];
        const subtitlesToInsert: NewProgramSubtitles[] = [];
        const creditsToInsert: NewCredit[] = [];
        const genresToInsert: Dictionary<NewGenre[]> = {};
        const studiosToInsert: Dictionary<NewStudio[]> = {};
        const tagsToInsert: Dictionary<NewTag[]> = {};
        for (const program of chunkResult) {
          const key = program.canonicalId;
          const request: Maybe<NewProgramWithRelations> =
            requestsByCanonicalId[key];
          const eids = request?.externalIds ?? [];
          for (const eid of eids) {
            eid.programUuid = program.uuid;
          }

          for (const version of request?.versions ?? []) {
            version.programId = program.uuid;
            versionsToInsert.push(version);
          }

          for (const art of request?.artwork ?? []) {
            art.programId = program.uuid;
            artworkToInsert.push(art);
          }

          for (const subtitle of request?.subtitles ?? []) {
            subtitle.programId = program.uuid;
            subtitlesToInsert.push(subtitle);
          }

          for (const { credit, artwork } of request?.credits ?? []) {
            credit.programId = program.uuid;
            creditsToInsert.push(credit);
            artworkToInsert.push(...artwork);
          }

          for (const genre of request?.genres ?? []) {
            genresToInsert[program.uuid] ??= [];
            genresToInsert[program.uuid]?.push(genre);
          }

          for (const studio of request?.studios ?? []) {
            studiosToInsert[program.uuid] ??= [];
            studiosToInsert[program.uuid]?.push(studio);
          }

          for (const tag of request?.tags ?? []) {
            tagsToInsert[program.uuid] ??= [];
            tagsToInsert[program.uuid]?.push(tag);
          }
        }

        const externalIdsByProgramId =
          this.externalIdRepo.upsertProgramExternalIds(allExternalIds);

        this.upsertProgramVersions(versionsToInsert);

        this.metadataRepo.upsertCredits(creditsToInsert);

        this.metadataRepo.upsertArtwork(artworkToInsert);

        await this.metadataRepo.upsertSubtitles(subtitlesToInsert);

        for (const [programId, genres] of Object.entries(genresToInsert)) {
          await this.metadataRepo.upsertProgramGenres(programId, genres);
        }

        for (const [programId, studios] of Object.entries(studiosToInsert)) {
          await this.metadataRepo.upsertProgramStudios(programId, studios);
        }

        for (const [programId, tags] of Object.entries(tagsToInsert)) {
          await this.metadataRepo.upsertProgramTags(programId, tags);
        }

        return chunkResult.map(
          (upsertedProgram) =>
            ({
              ...upsertedProgram,
              externalIds: externalIdsByProgramId[upsertedProgram.uuid] ?? [],
            }) satisfies ProgramWithExternalIds,
        );
      }),
    ).then(flatten);

    if (wasSingleRequest) {
      return head(result)!;
    } else {
      return result;
    }
  }

  private upsertProgramVersions(versions: NewProgramVersion[]) {
    if (versions.length === 0) {
      this.logger.warn('No program versions passed for item');
      return [];
    }

    const insertedVersions: ProgramVersion[] = [];
    this.drizzleDB.transaction((tx) => {
      const byProgramId = groupByUniq(versions, (version) => version.programId);
      for (const batch of chunk(Object.entries(byProgramId), 50)) {
        const [programIds, versionBatch] = myUnzip(batch);
        tx.delete(ProgramVersion)
          .where(inArray(ProgramVersion.programId, programIds))
          .run();

        const insertResult = tx
          .insert(ProgramVersion)
          .values(
            versionBatch.map((version) =>
              omit(version, ['chapters', 'mediaStreams', 'mediaFiles']),
            ),
          )
          .returning()
          .all();

        this.upsertProgramMediaStreams(
          versionBatch.flatMap(({ mediaStreams }) => mediaStreams),
          tx,
        );
        this.upsertProgramChapters(
          versionBatch.flatMap(({ chapters }) => chapters ?? []),
          tx,
        );
        this.upsertProgramMediaFiles(
          versionBatch.flatMap(({ mediaFiles }) => mediaFiles),
          tx,
        );

        insertedVersions.push(...insertResult);
      }
    });
    return insertedVersions;
  }

  private upsertProgramMediaStreams(
    streams: NewProgramMediaStream[],
    tx: DrizzleDBAccess = this.drizzleDB,
  ) {
    if (streams.length === 0) {
      this.logger.warn('No media streams passed for version');
      return [];
    }

    const byVersionId = groupBy(streams, (stream) => stream.programVersionId);
    const inserted: ProgramMediaStream[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = myUnzip(batch);
      inserted.push(
        ...tx
          .insert(ProgramMediaStream)
          .values(flatten(streams))
          .returning()
          .all(),
      );
    }
    return inserted;
  }

  private upsertProgramChapters(
    chapters: NewProgramChapter[],
    tx: DrizzleDBAccess = this.drizzleDB,
  ) {
    if (chapters.length === 0) {
      return [];
    }

    const byVersionId = groupBy(chapters, (stream) => stream.programVersionId);
    const inserted: ProgramChapter[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, streams] = myUnzip(batch);
      inserted.push(
        ...tx.insert(ProgramChapter).values(flatten(streams)).returning().all(),
      );
    }
    return inserted;
  }

  private upsertProgramMediaFiles(
    files: NewProgramMediaFile[],
    tx: DrizzleDBAccess = this.drizzleDB,
  ) {
    if (files.length === 0) {
      this.logger.warn('No media files passed for version');
      return [];
    }

    const byVersionId = groupBy(files, (stream) => stream.programVersionId);
    const inserted: ProgramMediaFile[] = [];
    for (const batch of chunk(Object.entries(byVersionId), 50)) {
      const [_, files] = myUnzip(batch);
      inserted.push(
        ...tx.insert(ProgramMediaFile).values(flatten(files)).returning().all(),
      );
    }
    return inserted;
  }
}
