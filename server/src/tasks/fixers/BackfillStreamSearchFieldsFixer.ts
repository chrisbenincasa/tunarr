import type { ISettingsDB } from '@/db/interfaces/ISettingsDB.js';
import Fixer from '@/tasks/fixers/fixer.js';
import { KEYS } from '@/types/inject.js';
import { InjectLogger } from '@/util/inject.js';
import { type Logger } from '@/util/logging/LoggerFactory.js';
import { asc, gt, inArray } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { last, uniq } from 'lodash-es';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { Program } from '../../db/schema/Program.ts';
import { ProgramMediaStream } from '../../db/schema/ProgramMediaStream.ts';
import { ProgramVersion } from '../../db/schema/ProgramVersion.ts';
import {
  getUniqueStreamLanguages,
  getUniqueStreamTitles,
  MeilisearchService,
} from '../../services/MeilisearchService.ts';
import { getStoredSubtitleLanguages } from './storedSubtitleLanguages.ts';

/**
 * Matches the search service's document lookup page size, so each page of
 * programs costs one index lookup.
 */
const PageSize = 100;

type StreamFields = {
  audioTitles: string[];
  subtitleTitles: string[];
  subtitleLanguages: string[];
};

/**
 * Brings existing search documents up to date with fields added after they
 * were indexed: audio and subtitle track titles, and subtitle languages that
 * include external subtitle files. Only these fields are sent, and programs
 * missing from the index are skipped. Runs once; completion is recorded in the
 * settings file.
 */
@injectable()
export class BackfillStreamSearchFieldsFixer extends Fixer {
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
    if (this.settingsDB.migrationState.hasBackfilledStreamSearchFields) {
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
      const fields = this.getStreamFields(indexedIds);

      const partials = indexedIds.map((id) => ({
        id,
        audioTitles: fields.get(id)?.audioTitles ?? [],
        subtitleTitles: fields.get(id)?.subtitleTitles ?? [],
        subtitleLanguages: fields.get(id)?.subtitleLanguages ?? [],
      }));
      await this.searchService.updatePrograms(partials);
      updated += partials.length;
    }

    this.logger.info(
      'Added track titles and subtitle languages to %d search document(s)',
      updated,
    );

    await this.settingsDB.updateBaseSettings('migration', {
      hasBackfilledStreamSearchFields: true,
    });
  }

  private getStreamFields(programIds: string[]): Map<string, StreamFields> {
    const result = new Map<string, StreamFields>();
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

    const streams =
      programByVersion.size === 0
        ? []
        : this.drizzle
            .select({
              programVersionId: ProgramMediaStream.programVersionId,
              streamType: ProgramMediaStream.streamKind,
              title: ProgramMediaStream.title,
              languageCodeISO6392: ProgramMediaStream.language,
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
    const storedSubtitleLanguages = getStoredSubtitleLanguages(
      this.drizzle,
      programIds,
    );

    for (const programId of programIds) {
      const programStreams = streamsByProgram.get(programId) ?? [];
      result.set(programId, {
        audioTitles: getUniqueStreamTitles(programStreams, ['audio']),
        subtitleTitles: getUniqueStreamTitles(programStreams, [
          'subtitles',
          'external_subtitles',
        ]),
        // Stored subtitles cover local sidecar files. Merging in the streams
        // keeps every language the document already has.
        subtitleLanguages: uniq([
          ...getUniqueStreamLanguages(programStreams, [
            'subtitles',
            'external_subtitles',
          ]),
          ...(storedSubtitleLanguages.get(programId) ?? []),
        ]),
      });
    }
    return result;
  }
}
