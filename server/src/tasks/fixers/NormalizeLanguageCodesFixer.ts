import { LanguageService } from '@/services/LanguageService.js';
import { MeilisearchService } from '@/services/MeilisearchService.js';
import { KEYS } from '@/types/inject.js';
import { eq, inArray, isNotNull } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { ProgramMediaStream } from '../../db/schema/ProgramMediaStream.ts';
import { ProgramSubtitles } from '../../db/schema/ProgramSubtitles.ts';
import { ProgramVersion } from '../../db/schema/ProgramVersion.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { InjectLogger } from '../../util/inject.ts';
import { type Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

/**
 * Bounded batch size: keeps the row list, the UPDATE's bound variables and the
 * search refresh payloads off SQLite's variable limit (32766) and out of
 * unbounded memory on large libraries.
 */
const BatchSize = 500;

/** How many ids to look up in the index at a time. */
const IdLookupBatchSize = 100;

type StreamKind = (typeof ProgramMediaStream.$inferSelect)['streamKind'];
type FacetKind = 'audio' | 'subtitles';

/** Stream kinds whose languages are published as search facets. */
const FacetStreamKinds: Partial<Record<StreamKind, FacetKind>> = {
  audio: 'audio',
  subtitles: 'subtitles',
};

type AffectedRow = { uuid: string; programId: string };

/**
 * ISO 639-2 assigns 20 languages both a bibliographic (/B) and a terminological
 * (/T) three-letter code (German `ger`/`deu`, French `fre`/`fra`, …). Ingest
 * paths have written the provider's code verbatim, so the persisted columns and
 * the Meilisearch facets built from them hold a mix of the two sets depending on
 * where a program came from — a language filter matches only part of the
 * library (#2044). We now normalize on write (see `normalizeLanguageCode`); this
 * fixer repairs the rows written before the fix and republishes the language
 * facets of the programs it touched, so the index heals at startup instead of
 * waiting for the next scan.
 *
 * Idempotent: already-/T codes and unresolvable values (e.g. the `'unknown'`
 * subtitle sentinel) pass through unchanged, so re-running is a no-op.
 */
@injectable()
export class NormalizeLanguageCodesFixer extends Fixer {
  canRunInBackground: boolean = true;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(
    @inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess,
    @inject(MeilisearchService) private searchService: MeilisearchService,
  ) {
    super();
  }

  protected async runInternal(): Promise<void> {
    // Fixers run before Meilisearch starts. Waiting here is safe because this
    // fixer runs in the background, and every batch publishes to the index
    // right after its DB update.
    await this.searchService.waitUntilReady();

    const streams = await this.normalizeStreams();
    const subtitles = await this.normalizeSubtitles();
    const total = streams + subtitles;
    if (total > 0) {
      this.logger.info(
        'Normalized %d stored language code(s) to ISO 639-2/T and refreshed their search documents (media streams: %d, subtitles: %d)',
        total,
        streams,
        subtitles,
      );
    } else {
      this.logger.debug(
        'No stored language codes needed ISO 639-2/T normalization',
      );
    }
  }

  private getNormalizedLanguage(language: string | null) {
    if (!language) {
      return;
    }

    const normalized = LanguageService.normalizeToAlpha3T(language);
    return normalized && normalized !== language ? normalized : undefined;
  }

  private async normalizeStreams(): Promise<number> {
    const languages = this.drizzleDB
      .selectDistinct({ language: ProgramMediaStream.language })
      .from(ProgramMediaStream)
      .where(isNotNull(ProgramMediaStream.language))
      .all();

    let touched = 0;
    for (const { language } of languages) {
      const normalized = this.getNormalizedLanguage(language);
      if (!language || !normalized) {
        continue;
      }

      touched += await this.normalizeStreamLanguage(language, normalized);
    }
    return touched;
  }

  private async normalizeStreamLanguage(
    language: string,
    normalized: string,
  ): Promise<number> {
    let touched = 0;
    let rows: AffectedRow[];
    do {
      rows = this.drizzleDB
        .select({
          uuid: ProgramMediaStream.uuid,
          programId: ProgramVersion.programId,
        })
        .from(ProgramMediaStream)
        .innerJoin(
          ProgramVersion,
          eq(ProgramMediaStream.programVersionId, ProgramVersion.uuid),
        )
        .where(eq(ProgramMediaStream.language, language))
        .limit(BatchSize)
        .all();

      if (rows.length === 0) {
        break;
      }

      const result = this.drizzleDB
        .update(ProgramMediaStream)
        .set({ language: normalized })
        .where(
          inArray(
            ProgramMediaStream.uuid,
            rows.map(({ uuid }) => uuid),
          ),
        )
        .run();
      touched += result.changes;
      await this.refreshSearchDocuments(rows.map(({ programId }) => programId));
    } while (rows.length === BatchSize);

    return touched;
  }

  private async normalizeSubtitles(): Promise<number> {
    const languages = this.drizzleDB
      .selectDistinct({ language: ProgramSubtitles.language })
      .from(ProgramSubtitles)
      .all();

    let touched = 0;
    for (const { language } of languages) {
      const normalized = this.getNormalizedLanguage(language);
      if (!language || !normalized) {
        continue;
      }

      touched += await this.normalizeSubtitleLanguage(language, normalized);
    }
    return touched;
  }

  private async normalizeSubtitleLanguage(
    language: string,
    normalized: string,
  ): Promise<number> {
    let touched = 0;
    let rows: AffectedRow[];
    do {
      rows = this.drizzleDB
        .select({
          uuid: ProgramSubtitles.uuid,
          programId: ProgramSubtitles.programId,
        })
        .from(ProgramSubtitles)
        .where(eq(ProgramSubtitles.language, language))
        .limit(BatchSize)
        .all();

      if (rows.length === 0) {
        break;
      }

      const result = this.drizzleDB
        .update(ProgramSubtitles)
        .set({ language: normalized })
        .where(
          inArray(
            ProgramSubtitles.uuid,
            rows.map(({ uuid }) => uuid),
          ),
        )
        .run();
      touched += result.changes;
      await this.refreshSearchDocuments(rows.map(({ programId }) => programId));
    } while (rows.length === BatchSize);

    return touched;
  }

  /**
   * Republish the language facets of the programs we just normalized. Only the
   * two language fields are sent, as a partial update: everything else in a
   * search document is owned by the scan path, which is the only place that
   * knows the full record (grouping parents, tags, state, …). Programs that are
   * not in the index yet are skipped, so the backfill never creates a stub
   * document; the next scan indexes them with the corrected codes.
   */
  private async refreshSearchDocuments(programIds: string[]) {
    const uniqueProgramIds = [...new Set(programIds)];
    const facets = this.getFacetLanguages(uniqueProgramIds);
    if (facets.size === 0) {
      return;
    }

    const indexedIds = new Set<string>();
    for (let i = 0; i < uniqueProgramIds.length; i += IdLookupBatchSize) {
      const documents = await this.searchService.getPrograms(
        uniqueProgramIds.slice(i, i + IdLookupBatchSize),
      );
      for (const document of documents) {
        indexedIds.add(document.id);
      }
    }

    const partials = [...facets]
      .filter(([id]) => indexedIds.has(id))
      .map(([id, languages]) => ({
        id,
        audioLanguages: languages.audio,
        subtitleLanguages: languages.subtitles,
      }));

    if (partials.length === 0) {
      return;
    }

    await this.searchService.updatePrograms(partials);
  }

  private getFacetLanguages(
    programIds: string[],
  ): Map<string, Record<FacetKind, string[]>> {
    const versions = this.drizzleDB
      .select({
        uuid: ProgramVersion.uuid,
        programId: ProgramVersion.programId,
        createdAt: ProgramVersion.createdAt,
      })
      .from(ProgramVersion)
      .where(inArray(ProgramVersion.programId, programIds))
      .all();

    // Mirror the search document, which is built from a program's first version.
    const firstVersionByProgram = new Map<string, string>();
    const firstVersionCreatedAt = new Map<string, number>();
    for (const version of versions) {
      const createdAt = +version.createdAt;
      const current = firstVersionCreatedAt.get(version.programId);
      if (current === undefined || createdAt < current) {
        firstVersionCreatedAt.set(version.programId, createdAt);
        firstVersionByProgram.set(version.programId, version.uuid);
      }
    }

    const result = new Map<string, Record<FacetKind, string[]>>();
    const programByVersion = new Map<string, string>();
    for (const [programId, versionUuid] of firstVersionByProgram) {
      programByVersion.set(versionUuid, programId);
      result.set(programId, { audio: [], subtitles: [] });
    }

    if (programByVersion.size === 0) {
      return result;
    }

    const streams = this.drizzleDB
      .select({
        programVersionId: ProgramMediaStream.programVersionId,
        streamKind: ProgramMediaStream.streamKind,
        language: ProgramMediaStream.language,
      })
      .from(ProgramMediaStream)
      .where(
        inArray(ProgramMediaStream.programVersionId, [
          ...programByVersion.keys(),
        ]),
      )
      .all();

    for (const stream of streams) {
      const programId = programByVersion.get(stream.programVersionId);
      const facetKind = FacetStreamKinds[stream.streamKind];
      // Normalize on read so a batch published mid-backfill already carries the
      // final value, exactly like the ingest path does.
      const language = LanguageService.normalizeLanguageCode(stream.language);
      if (!programId || !facetKind || !language) {
        continue;
      }

      const languages = result.get(programId)?.[facetKind];
      if (languages && !languages.includes(language)) {
        languages.push(language);
      }
    }

    return result;
  }
}
