import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { asc, gt, inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { last } from 'lodash-es';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { Program } from '../../db/schema/Program.ts';
import { ProgramMediaStream } from '../../db/schema/ProgramMediaStream.ts';
import { ProgramVersion } from '../../db/schema/ProgramVersion.ts';
import {
  getUniqueStreamTitles,
  MeilisearchService,
} from '../../services/MeilisearchService.ts';

/**
 * Matches the search service's document lookup page size, so each page of
 * programs costs one index lookup.
 */
const PageSize = 100;

/**
 * Adds audio and subtitle track titles to existing search documents. New
 * documents get them at index time; this covers programs indexed before the
 * fields existed. Only the two title fields are sent, and programs missing
 * from the index are skipped. Runs once; completion is recorded in the
 * settings file.
 */
@injectable()
export class BackfillTrackTitleSearchFixer extends Fixer {
  @InjectLogger() declare protected readonly logger: Logger;

  canRunInBackground = true;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzle: DrizzleDBAccess,
    @inject(MeilisearchService) private searchService: MeilisearchService,
    @inject(KEYS.SettingsDB) private settingsDB: ISettingsDB,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    if (this.settingsDB.migrationState.hasBackfilledTrackTitleSearch) {
      return;
    }

    // Fixers start before Meilisearch does. Waiting is safe because this
    // fixer runs in the background.
    await this.searchService.waitUntilReady();

    let lastId: string | undefined;
    let updated = 0;
    for (;;) {
      const page = this.drizzle
        .select({ uuid: Program.uuid })
        .from(Program)
        .where(lastId ? gt(Program.uuid, lastId) : undefined)
        .orderBy(asc(Program.uuid))
        .limit(PageSize)
        .all();
      if (page.length === 0) {
        break;
      }
      lastId = last(page)?.uuid;

      const programIds = page.map(({ uuid }) => uuid);
      const indexed = await this.searchService.getPrograms(programIds);
      const indexedIds = indexed.map(({ id }) => id);
      const titles = this.getTrackTitles(indexedIds);

      const partials = indexedIds.map((id) => ({
        id,
        audioTitles: titles.get(id)?.audio ?? [],
        subtitleTitles: titles.get(id)?.subtitles ?? [],
      }));
      await this.searchService.updatePrograms(partials);
      updated += partials.length;
    }

    this.logger.info('Added track titles to %d search document(s)', updated);

    await this.settingsDB.updateBaseSettings('migration', {
      hasBackfilledTrackTitleSearch: true,
    });
  }

  private getTrackTitles(
    programIds: string[],
  ): Map<string, { audio: string[]; subtitles: string[] }> {
    const result = new Map<string, { audio: string[]; subtitles: string[] }>();
    if (programIds.length === 0) {
      return result;
    }

    const versions = this.drizzle
      .select({
        uuid: ProgramVersion.uuid,
        programId: ProgramVersion.programId,
        createdAt: ProgramVersion.createdAt,
      })
      .from(ProgramVersion)
      .where(inArray(ProgramVersion.programId, programIds))
      .all();

    // Mirror the search document, which is built from a program's first version.
    const firstVersions = new Map<
      string,
      { uuid: string; createdAt: number }
    >();
    for (const version of versions) {
      const createdAt = +version.createdAt;
      const current = firstVersions.get(version.programId);
      if (!current || createdAt < current.createdAt) {
        firstVersions.set(version.programId, { uuid: version.uuid, createdAt });
      }
    }

    const programByVersion = new Map<string, string>();
    for (const [programId, { uuid }] of firstVersions) {
      programByVersion.set(uuid, programId);
    }
    if (programByVersion.size === 0) {
      return result;
    }

    const streams = this.drizzle
      .select({
        programVersionId: ProgramMediaStream.programVersionId,
        streamType: ProgramMediaStream.streamKind,
        title: ProgramMediaStream.title,
      })
      .from(ProgramMediaStream)
      .where(
        inArray(ProgramMediaStream.programVersionId, [
          ...programByVersion.keys(),
        ]),
      )
      .all();

    const streamsByProgram = Map.groupBy(streams, (stream) =>
      programByVersion.get(stream.programVersionId),
    );
    for (const [programId, programStreams] of streamsByProgram) {
      if (!programId) {
        continue;
      }
      result.set(programId, {
        audio: getUniqueStreamTitles(programStreams, ['audio']),
        subtitles: getUniqueStreamTitles(programStreams, [
          'subtitles',
          'external_subtitles',
        ]),
      });
    }
    return result;
  }
}
