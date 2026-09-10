import { LanguageService } from '@/services/LanguageService.js';
import { KEYS } from '@/types/inject.js';
import { inArray, isNotNull } from 'drizzle-orm';
import { inject, injectable } from 'inversify';
import { ProgramMediaStream } from '../../db/schema/ProgramMediaStream.ts';
import { ProgramSubtitles } from '../../db/schema/ProgramSubtitles.ts';
import type { DrizzleDBAccess } from '../../db/schema/index.ts';
import { InjectLogger } from '../../util/inject.ts';
import { type Logger } from '../../util/logging/LoggerFactory.ts';
import Fixer from './fixer.ts';

/**
 * ISO 639-2 assigns 20 languages both a bibliographic (/B) and a terminological
 * (/T) three-letter code (German `ger`/`deu`, French `fre`/`fra`, …). Ingest
 * paths have written the provider's code verbatim, so the persisted columns and
 * the Meilisearch facets built from them hold a mix of the two sets depending on
 * where a program came from — a language filter matches only part of the
 * library (#2044). We now normalize on write (see `normalizeLanguageCode`); this
 * fixer repairs the rows written before the fix.
 *
 * Idempotent: already-/T codes and unresolvable values (e.g. the `'unknown'`
 * subtitle sentinel) pass through unchanged, so re-running is a no-op.
 */
@injectable()
export class NormalizeLanguageCodesFixer extends Fixer {
  canRunInBackground: boolean = true;

  @InjectLogger() declare protected readonly logger: Logger;

  constructor(@inject(KEYS.DrizzleDB) private drizzleDB: DrizzleDBAccess) {
    super();
  }

  protected runInternal(): Promise<void> {
    const streams = this.normalizeStreams();
    const subtitles = this.normalizeSubtitles();
    const total = streams + subtitles;
    if (total > 0) {
      this.logger.info(
        'Normalized %d stored language code(s) to ISO 639-2/T (media streams: %d, subtitles: %d)',
        total,
        streams,
        subtitles,
      );
    } else {
      this.logger.debug(
        'No stored language codes needed ISO 639-2/T normalization',
      );
    }
    return Promise.resolve(void 0);
  }

  /**
   * Plan which rows change and fire one update per distinct normalized code,
   * then report how many rows were touched (idempotent — only rows whose code
   * actually resolves to a different /T code are updated).
   */
  private normalizeRows(
    rows: Array<{ uuid: string; language: string | null }>,
    update: (normalized: string, uuids: string[]) => void,
  ): number {
    const byNormalized = new Map<string, string[]>();
    for (const { uuid, language } of rows) {
      if (!language) {
        continue;
      }
      const normalized = LanguageService.normalizeToAlpha3T(language);
      if (!normalized || normalized === language) {
        continue;
      }
      const uuids = byNormalized.get(normalized) ?? [];
      uuids.push(uuid);
      byNormalized.set(normalized, uuids);
    }
    for (const [normalized, uuids] of byNormalized) {
      update(normalized, uuids);
    }
    let touched = 0;
    for (const uuids of byNormalized.values()) {
      touched += uuids.length;
    }
    return touched;
  }

  private normalizeStreams(): number {
    const rows = this.drizzleDB
      .select({
        uuid: ProgramMediaStream.uuid,
        language: ProgramMediaStream.language,
      })
      .from(ProgramMediaStream)
      .where(isNotNull(ProgramMediaStream.language))
      .all();
    return this.normalizeRows(rows, (normalized, uuids) => {
      this.drizzleDB
        .update(ProgramMediaStream)
        .set({ language: normalized })
        .where(inArray(ProgramMediaStream.uuid, uuids))
        .run();
    });
  }

  private normalizeSubtitles(): number {
    const rows = this.drizzleDB
      .select({
        uuid: ProgramSubtitles.uuid,
        language: ProgramSubtitles.language,
      })
      .from(ProgramSubtitles)
      .all();
    return this.normalizeRows(rows, (normalized, uuids) => {
      this.drizzleDB
        .update(ProgramSubtitles)
        .set({ language: normalized })
        .where(inArray(ProgramSubtitles.uuid, uuids))
        .run();
    });
  }
}